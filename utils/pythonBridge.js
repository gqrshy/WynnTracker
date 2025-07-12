const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class PythonBridge {
    constructor() {
        this.pythonPath = 'python3';
        this.scriptPath = path.join(__dirname, '..', 'python', 'arima_predictor.py');
        this.isAvailable = null;
    }

    async checkAvailability() {
        if (this.isAvailable !== null) {
            return this.isAvailable;
        }

        try {
            // Check if Python script exists
            if (!fs.existsSync(this.scriptPath)) {
                console.warn('[WARN] ARIMA predictor script not found');
                this.isAvailable = false;
                return false;
            }

            // Test Python execution with a simple check
            const result = await this.runPython(['--next']);
            this.isAvailable = result.success;
            
            if (!this.isAvailable) {
                console.warn('[WARN] ARIMA predictor not available:', result.error);
                if (result.stderr) {
                    console.warn('[WARN] ARIMA stderr:', result.stderr);
                }
                console.log('[INFO] To enable ARIMA predictions, install: pip3 install pandas statsmodels numpy');
            } else {
                console.log('[INFO] ARIMA predictor is available and working');
            }

            return this.isAvailable;
        } catch (error) {
            console.warn('[WARN] Python bridge check failed:', error.message);
            this.isAvailable = false;
            return false;
        }
    }

    async getNextPrediction() {
        const available = await this.checkAvailability();
        if (!available) {
            console.log('[DEBUG] ARIMA predictor not available - Python dependencies missing');
            return {
                success: false,
                error: 'ARIMA predictor not available. Install Python dependencies: pip install pandas statsmodels numpy',
                source: 'ARIMA'
            };
        }

        try {
            const result = await this.runPython(['--next']);
            
            if (result.success && result.data) {
                const data = result.data;
                
                if (data.success && data.next_event) {
                    return {
                        success: true,
                        nextEvent: new Date(data.next_event.datetime_utc),
                        confidence: data.next_event.confidence || 75,
                        source: 'ARIMA',
                        method: data.model_info?.method || 'arima',
                        modelInfo: data.model_info,
                        qualityMetrics: data.quality_metrics,
                        intervalDays: data.next_event.interval_days
                    };
                } else {
                    return {
                        success: false,
                        error: data.error || 'ARIMA prediction failed',
                        source: 'ARIMA'
                    };
                }
            } else {
                return {
                    success: false,
                    error: result.error || 'Python execution failed',
                    source: 'ARIMA'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `ARIMA bridge error: ${error.message}`,
                source: 'ARIMA'
            };
        }
    }

    async getAllPredictions(numPredictions = 5) {
        const available = await this.checkAvailability();
        if (!available) {
            return {
                success: false,
                error: 'ARIMA predictor not available',
                source: 'ARIMA'
            };
        }

        try {
            const result = await this.runPython(['--all', numPredictions.toString()]);
            
            if (result.success && result.data) {
                const data = result.data;
                
                if (data.success && data.predictions) {
                    return {
                        success: true,
                        predictions: data.predictions.map(pred => ({
                            nextEvent: new Date(pred.datetime_utc),
                            confidence: pred.confidence,
                            intervalDays: pred.interval_days,
                            rank: pred.rank
                        })),
                        source: 'ARIMA',
                        method: data.model_info?.method || 'arima',
                        modelInfo: data.model_info,
                        qualityMetrics: data.quality_metrics,
                        dataPoints: data.data_points
                    };
                } else {
                    return {
                        success: false,
                        error: data.error || 'ARIMA prediction failed',
                        source: 'ARIMA'
                    };
                }
            } else {
                return {
                    success: false,
                    error: result.error || 'Python execution failed',
                    source: 'ARIMA'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `ARIMA bridge error: ${error.message}`,
                source: 'ARIMA'
            };
        }
    }

    runPython(args = [], timeout = 30000) {
        return new Promise((resolve) => {
            // PATHに~/.local/binを追加してPythonパッケージを見つけられるようにする
            const env = {
                ...process.env,
                PATH: `${process.env.PATH}:/home/gqrshy/.local/bin`,
                PYTHONPATH: `/home/gqrshy/.local/lib/python3.10/site-packages:${process.env.PYTHONPATH || ''}`
            };
            
            const pythonProcess = spawn(this.pythonPath, [this.scriptPath, ...args], {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: timeout,
                env: env
            });

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const data = JSON.parse(stdout);
                        resolve({
                            success: true,
                            data: data,
                            raw: stdout
                        });
                    } catch (parseError) {
                        resolve({
                            success: false,
                            error: `JSON parse error: ${parseError.message}`,
                            raw: stdout,
                            stderr: stderr
                        });
                    }
                } else {
                    resolve({
                        success: false,
                        error: `Python process exited with code ${code}`,
                        stderr: stderr,
                        raw: stdout
                    });
                }
            });

            pythonProcess.on('error', (error) => {
                resolve({
                    success: false,
                    error: `Process error: ${error.message}`,
                    stderr: stderr
                });
            });

            // Handle timeout
            setTimeout(() => {
                if (!pythonProcess.killed) {
                    pythonProcess.kill('SIGTERM');
                    resolve({
                        success: false,
                        error: 'Python process timeout',
                        stderr: stderr
                    });
                }
            }, timeout);
        });
    }

    // Utility method to test the bridge
    async testBridge() {
        console.log('[INFO] Testing Python ARIMA bridge...');
        
        const available = await this.checkAvailability();
        console.log(`[INFO] Bridge available: ${available}`);
        
        if (available) {
            const prediction = await this.getNextPrediction();
            console.log('[INFO] Test prediction:', prediction);
        }
        
        return available;
    }
}

module.exports = { PythonBridge };