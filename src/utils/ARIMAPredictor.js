const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * ARIMA予測エンジン - Wynnpoolと同等の精度を目指す
 * ARIMA(1,1,1)モデルを使用した時系列予測
 */
class ARIMAPredictor {
    constructor(order = [1, 1, 1]) {
        this.order = order;
        this.pythonScriptPath = path.join(__dirname, '..', '..', 'python', 'arima_predictor.py');
        this.isAvailable = null;
        this.model = null;
    }

    /**
     * Python環境とARIMAライブラリの利用可能性チェック
     */
    async checkAvailability() {
        if (this.isAvailable !== null) {
            return this.isAvailable;
        }

        try {
            // Python環境のテスト
            const result = await this.runPython(['--test']);
            this.isAvailable = result.success;
            
            if (!this.isAvailable) {
                console.warn('[WARN] ARIMA predictor not available:', result.error);
                console.log('[INFO] Install requirements: pip install pandas statsmodels numpy');
            } else {
                console.log('[INFO] ARIMA predictor available with enhanced accuracy');
            }
            
            return this.isAvailable;
        } catch (error) {
            console.warn('[WARN] ARIMA availability check failed:', error.message);
            this.isAvailable = false;
            return false;
        }
    }

    /**
     * ARIMAモデルの学習
     * @param {Array} eventTimestamps - イベントタイムスタンプの配列
     * @param {Object} options - 学習オプション
     */
    async fit(eventTimestamps, options = {}) {
        const available = await this.checkAvailability();
        if (!available) {
            throw new Error('ARIMA predictor not available');
        }

        try {
            // タイムスタンプを時間間隔に変換
            const intervals = this.calculateIntervals(eventTimestamps);
            
            if (intervals.length < 5) {
                throw new Error('Insufficient data for ARIMA model (need at least 5 intervals)');
            }

            // Python ARIMAスクリプトの実行
            const result = await this.runPython([
                '--fit',
                '--data', JSON.stringify(intervals),
                '--order', JSON.stringify(this.order),
                '--validate', options.validate ? 'true' : 'false'
            ]);

            if (!result.success) {
                throw new Error(`ARIMA fitting failed: ${result.error}`);
            }

            // result.dataは既にJSONパース済みのオブジェクト
            this.model = result.data;
            return this.model;

        } catch (error) {
            throw new Error(`ARIMA fit error: ${error.message}`);
        }
    }

    /**
     * 予測の実行
     * @param {number} steps - 予測ステップ数
     */
    async predict(steps = 10) {
        if (!this.model) {
            throw new Error('Model not fitted. Call fit() first.');
        }

        try {
            const result = await this.runPython([
                '--predict',
                '--model', JSON.stringify(this.model),
                '--steps', steps.toString()
            ]);

            if (!result.success) {
                throw new Error(`ARIMA prediction failed: ${result.error}`);
            }

            return result.data.predictions.map((prediction, index) => ({
                stepAhead: index + 1,
                predictedInterval: prediction.interval,
                confidence: prediction.confidence,
                lowerBound: prediction.lower_bound,
                upperBound: prediction.upper_bound
            }));

        } catch (error) {
            throw new Error(`ARIMA prediction error: ${error.message}`);
        }
    }

    /**
     * 次のAnnihilation予測
     * @param {Array} eventTimestamps - イベントタイムスタンプの配列
     */
    async predictNextEvent(eventTimestamps) {
        if (eventTimestamps.length === 0) {
            throw new Error('No event data available');
        }

        try {
            // モデルの学習
            await this.fit(eventTimestamps, { validate: true });

            // 1ステップ先の予測
            const predictions = await this.predict(1);
            const nextPrediction = predictions[0];

            // 最後のイベントから次のイベント時刻を計算
            const lastEventTime = Math.max(...eventTimestamps);
            const predictedTime = lastEventTime + (nextPrediction.predictedInterval * 1000);

            return {
                datetime_utc: predictedTime,
                predicted: true,
                confidence: nextPrediction.confidence,
                method: 'ARIMA',
                model_info: {
                    order: this.order,
                    interval_prediction: nextPrediction.predictedInterval,
                    confidence_interval: {
                        lower: nextPrediction.lowerBound,
                        upper: nextPrediction.upperBound
                    }
                }
            };

        } catch (error) {
            throw new Error(`Next event prediction error: ${error.message}`);
        }
    }

    /**
     * 複数の次期イベント予測
     * @param {Array} eventTimestamps - イベントタイムスタンプの配列
     * @param {number} numPredictions - 予測数
     */
    async predictMultipleEvents(eventTimestamps, numPredictions = 5) {
        if (eventTimestamps.length === 0) {
            throw new Error('No event data available');
        }

        try {
            // モデルの学習
            await this.fit(eventTimestamps, { validate: true });

            // 複数ステップ先の予測
            const predictions = await this.predict(numPredictions);
            const lastEventTime = Math.max(...eventTimestamps);

            const results = [];
            let cumulativeTime = lastEventTime;

            for (const prediction of predictions) {
                cumulativeTime += (prediction.predictedInterval * 1000);
                
                results.push({
                    datetime_utc: cumulativeTime,
                    predicted: true,
                    confidence: prediction.confidence,
                    step_ahead: prediction.stepAhead,
                    interval_prediction: prediction.predictedInterval,
                    confidence_interval: {
                        lower: prediction.lowerBound,
                        upper: prediction.upperBound
                    }
                });
            }

            return results;

        } catch (error) {
            throw new Error(`Multiple events prediction error: ${error.message}`);
        }
    }

    /**
     * 予測精度の評価
     * @param {Array} eventTimestamps - イベントタイムスタンプの配列
     * @param {number} testSize - テストデータサイズ
     */
    async evaluateAccuracy(eventTimestamps, testSize = 5) {
        if (eventTimestamps.length < testSize + 5) {
            throw new Error('Insufficient data for accuracy evaluation');
        }

        try {
            const trainData = eventTimestamps.slice(0, -testSize);
            const testData = eventTimestamps.slice(-testSize);

            const results = [];

            for (let i = 0; i < testSize; i++) {
                const currentTrain = trainData.concat(testData.slice(0, i));
                const actualEvent = testData[i];

                // 予測の実行
                const prediction = await this.predictNextEvent(currentTrain);
                
                // 精度計算
                const error = Math.abs(prediction.datetime_utc - actualEvent);
                const errorHours = error / (1000 * 60 * 60);
                const errorDays = errorHours / 24;

                results.push({
                    actual: actualEvent,
                    predicted: prediction.datetime_utc,
                    error_ms: error,
                    error_hours: errorHours,
                    error_days: errorDays,
                    confidence: prediction.confidence
                });
            }

            // 統計計算
            const avgError = results.reduce((sum, r) => sum + r.error_hours, 0) / results.length;
            const maxError = Math.max(...results.map(r => r.error_hours));
            const minError = Math.min(...results.map(r => r.error_hours));

            return {
                average_error_hours: avgError,
                max_error_hours: maxError,
                min_error_hours: minError,
                accuracy_score: Math.max(0, 100 - (avgError / 24) * 100), // 24時間誤差で0%
                test_results: results
            };

        } catch (error) {
            throw new Error(`Accuracy evaluation error: ${error.message}`);
        }
    }

    /**
     * タイムスタンプから時間間隔を計算
     * @param {Array} timestamps - タイムスタンプの配列
     */
    calculateIntervals(timestamps) {
        if (timestamps.length < 2) {
            return [];
        }

        const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
        const intervals = [];

        for (let i = 1; i < sortedTimestamps.length; i++) {
            const interval = (sortedTimestamps[i] - sortedTimestamps[i-1]) / 1000; // 秒単位
            intervals.push(interval);
        }

        return intervals;
    }

    /**
     * Python ARIMAスクリプトの実行
     * @param {Array} args - 引数の配列
     * @param {number} timeout - タイムアウト（ミリ秒）
     */
    runPython(args = [], timeout = 60000) {
        return new Promise((resolve) => {
            const pythonProcess = spawn('python3', [this.pythonScriptPath, ...args], {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: timeout
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
                            data: data
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
                    console.error('[ARIMAPredictor] Python process failed:', {
                        code: code,
                        stderr: stderr,
                        stdout: stdout,
                        args: args
                    });
                    resolve({
                        success: false,
                        error: `Process exited with code ${code}`,
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

            // タイムアウト処理
            setTimeout(() => {
                if (!pythonProcess.killed) {
                    pythonProcess.kill('SIGTERM');
                    resolve({
                        success: false,
                        error: 'Process timeout',
                        stderr: stderr
                    });
                }
            }, timeout);
        });
    }

    /**
     * モデルの状態をリセット
     */
    reset() {
        this.model = null;
    }

    /**
     * ARIMAモデルの診断情報を取得
     */
    async getDiagnostics() {
        if (!this.model) {
            return { error: 'Model not fitted' };
        }

        try {
            const result = await this.runPython([
                '--diagnostics',
                '--model', JSON.stringify(this.model)
            ]);

            return result.success ? result.data : { error: result.error };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * ARIMAモデルのパラメータを取得
     */
    getModelParameters() {
        if (!this.model) {
            return null;
        }

        return {
            order: this.order,
            aic: this.model.aic,
            bic: this.model.bic,
            hqic: this.model.hqic,
            fitted_values: this.model.fitted_values,
            residuals: this.model.residuals
        };
    }
}

module.exports = ARIMAPredictor;