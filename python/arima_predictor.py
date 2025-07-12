#!/usr/bin/env python3
"""
ARIMA-based Annihilation prediction module
Based on Wynnpool's prediction algorithm
"""

import sys
import os

# Add user site-packages to path for pip installed packages
import site
user_site = site.getusersitepackages()
if user_site not in sys.path:
    sys.path.insert(0, user_site)

# Also add common user installation paths
home_dir = os.path.expanduser("~")
user_lib_paths = [
    os.path.join(home_dir, ".local", "lib", "python3.10", "site-packages"),
    os.path.join(home_dir, ".local", "lib", "python3.11", "site-packages"),
    os.path.join(home_dir, ".local", "lib", "python3.9", "site-packages")
]

for path in user_lib_paths:
    if os.path.exists(path) and path not in sys.path:
        sys.path.insert(0, path)

import pandas as pd
import json
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

try:
    from statsmodels.tsa.arima.model import ARIMA
    import numpy as np
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Required packages not installed: {str(e)}. Run: pip3 install pandas statsmodels numpy",
        "python_path": sys.path
    }))
    sys.exit(1)

class ARIMAPredictor:
    def __init__(self, data_file=None):
        self.data_file = data_file or os.path.join(os.path.dirname(__file__), '..', 'data', 'anni_history.json')
        self.min_events = 3  # ARIMAには最低3イベント必要
        
    def load_history(self):
        """Load event history from JSON file"""
        try:
            if not os.path.exists(self.data_file):
                return []
                
            with open(self.data_file, 'r') as f:
                data = json.load(f)
                
            # Handle both old and new format
            if isinstance(data, dict) and 'events' in data:
                events = data['events']
            elif isinstance(data, list):
                events = data
            else:
                return []
                
            # Convert to standardized format and filter future events
            processed_events = []
            current_time_ms = int(datetime.now().timestamp() * 1000)
            
            for event in events:
                if 'timestamp' in event:
                    # New format
                    timestamp = pd.to_datetime(event['timestamp']).timestamp() * 1000
                elif 'datetime_utc' in event:
                    # Wynnpool format (already in ms)
                    timestamp = event['datetime_utc']
                else:
                    continue
                
                # Only include events that are in the past
                if timestamp <= current_time_ms:
                    processed_events.append({
                        'datetime_utc': int(timestamp),
                        'confidence': event.get('confidence', 100)
                    })
                
            # Sort by timestamp
            processed_events.sort(key=lambda x: x['datetime_utc'])
            print(f"[DEBUG] Loaded {len(processed_events)} past events out of {len(events)} total events", file=sys.stderr)
            return processed_events
            
        except Exception as e:
            print(f"ERROR loading history: {e}")
            return []
    
    def predict_next_events(self, num_predictions=5):
        """Predict next events using ARIMA model"""
        try:
            events = self.load_history()
            
            if len(events) < self.min_events:
                return {
                    'success': False,
                    'error': f'Need at least {self.min_events} events for ARIMA prediction',
                    'predictions': []
                }
            
            # Convert to pandas DataFrame
            df = pd.DataFrame(events)
            df['datetime_utc'] = pd.to_datetime(df['datetime_utc'], unit='ms')
            df = df.sort_values('datetime_utc').reset_index(drop=True)
            
            # Calculate intervals between events (in days)
            df['diff_days'] = df['datetime_utc'].diff().dt.total_seconds() / (24 * 3600)
            
            # Prepare time series (exclude first NaN value)
            diff_series = df['diff_days'].dropna()
            
            if len(diff_series) < 2:
                return {
                    'success': False,
                    'error': 'Not enough interval data for ARIMA',
                    'predictions': []
                }
            
            # Create time index for ARIMA
            start_date = df['datetime_utc'].iloc[1]  # Start from second event
            diff_series.index = pd.date_range(start=start_date, periods=len(diff_series), freq='D')
            
            # Fit ARIMA model
            try:
                # Try different ARIMA orders for best fit
                best_aic = float('inf')
                best_model = None
                best_order = None
                
                orders = [(1,1,1), (2,1,1), (1,1,2), (2,1,2), (1,0,1), (2,0,1)]
                
                for order in orders:
                    try:
                        model = ARIMA(diff_series, order=order)
                        fitted = model.fit()
                        if fitted.aic < best_aic:
                            best_aic = fitted.aic
                            best_model = fitted
                            best_order = order
                    except:
                        continue
                
                if best_model is None:
                    # Fallback to simple average
                    avg_interval = diff_series.mean()
                    forecast_intervals = [avg_interval] * num_predictions
                    model_info = {
                        'method': 'average_fallback',
                        'avg_interval': avg_interval,
                        'aic': None
                    }
                else:
                    # Use best ARIMA model
                    forecast_intervals = best_model.forecast(steps=num_predictions)
                    model_info = {
                        'method': 'arima',
                        'order': best_order,
                        'aic': best_aic,
                        'intervals': forecast_intervals.tolist()
                    }
                
                # Generate predictions
                last_event_date = df['datetime_utc'].iloc[-1]
                predicted_dates = []
                cumulative_days = 0
                
                for interval in forecast_intervals:
                    cumulative_days += interval
                    predicted_date = last_event_date + pd.Timedelta(days=cumulative_days)
                    predicted_dates.append(predicted_date)
                
                # Convert to output format
                predictions = []
                for i, pred_date in enumerate(predicted_dates):
                    predictions.append({
                        'datetime_utc': int(pred_date.timestamp() * 1000),
                        'predicted': True,
                        'confidence': max(60, 95 - (i * 5)),  # Decreasing confidence
                        'interval_days': float(forecast_intervals[i] if hasattr(forecast_intervals, '__getitem__') else forecast_intervals),
                        'rank': i + 1
                    })
                
                # Calculate prediction quality metrics
                quality_metrics = self.calculate_quality_metrics(df, model_info)
                
                return {
                    'success': True,
                    'predictions': predictions,
                    'model_info': model_info,
                    'quality_metrics': quality_metrics,
                    'data_points': len(events),
                    'generated_at': datetime.now().isoformat()
                }
                
            except Exception as e:
                return {
                    'success': False,
                    'error': f'ARIMA model failed: {str(e)}',
                    'predictions': []
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Prediction failed: {str(e)}',
                'predictions': []
            }
    
    def calculate_quality_metrics(self, df, model_info):
        """Calculate prediction quality metrics"""
        try:
            intervals = df['diff_days'].dropna()
            
            metrics = {
                'avg_interval_days': float(intervals.mean()),
                'std_interval_days': float(intervals.std()),
                'min_interval_days': float(intervals.min()),
                'max_interval_days': float(intervals.max()),
                'coefficient_of_variation': float(intervals.std() / intervals.mean()),
                'data_consistency': 'high' if intervals.std() < 0.5 else 'medium' if intervals.std() < 1.0 else 'low'
            }
            
            # Add model-specific metrics
            if model_info['method'] == 'arima' and model_info['aic']:
                metrics['model_aic'] = float(model_info['aic'])
                metrics['model_order'] = model_info['order']
            
            return metrics
            
        except Exception as e:
            return {'error': str(e)}
    
    def get_next_prediction(self):
        """Get only the next event prediction"""
        result = self.predict_next_events(num_predictions=1)
        if result['success'] and result['predictions']:
            return {
                'success': True,
                'next_event': result['predictions'][0],
                'model_info': result['model_info'],
                'quality_metrics': result['quality_metrics']
            }
        else:
            return result

def main():
    """Command line interface"""
    if len(sys.argv) > 1:
        if sys.argv[1] == '--next':
            # Get only next prediction
            predictor = ARIMAPredictor()
            result = predictor.get_next_prediction()
        elif sys.argv[1] == '--all':
            # Get multiple predictions
            num = int(sys.argv[2]) if len(sys.argv) > 2 else 5
            predictor = ARIMAPredictor()
            result = predictor.predict_next_events(num_predictions=num)
        else:
            print("Usage: python arima_predictor.py [--next|--all [num]]")
            sys.exit(1)
    else:
        # Default: get next prediction
        predictor = ARIMAPredictor()
        result = predictor.get_next_prediction()
    
    # Output JSON result
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()