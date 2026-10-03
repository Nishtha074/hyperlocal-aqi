import numpy as np

class SplitConformalPredictor:
    """
    Split Conformal Prediction Wrapper to provide prediction intervals.
    Can be used with any spatial or regression model that has fit() and predict() methods.
    """
    def __init__(self, base_model, alpha=0.1):
        """
        :param base_model: The underlying model to wrap.
        :param alpha: Significance level (e.g., 0.1 for 90% confidence interval).
        """
        self.base_model = base_model
        self.alpha = alpha
        self.q_hat = None
        
    def fit(self, X_train, y_train, X_calib, y_calib):
        """
        Fits the base model on the training set and computes the conformal quantile on the calibration set.
        
        :param X_train: Training features/coordinates
        :param y_train: Training targets
        :param X_calib: Calibration features/coordinates
        :param y_calib: Calibration targets
        """
        # 1. Fit the base model on the proper training set
        self.base_model.fit(X_train, y_train)
        
        # 2. Predict on the calibration set
        preds_calib = self.base_model.predict(X_calib)
        
        # 3. Calculate absolute residuals
        residuals = np.abs(y_calib - preds_calib)
        
        # 4. Calculate the empirical quantile
        n = len(y_calib)
        quantile_level = (1 - self.alpha) * (1 + 1 / n)
        
        # Cap quantile level at 1.0
        quantile_level = min(quantile_level, 1.0)
        
        # Use 'higher' interpolation to be conservative
        self.q_hat = np.quantile(residuals, quantile_level, method='higher')
        
        return self
        
    def predict(self, X_test):
        """
        Predict targets and output prediction intervals.
        
        :param X_test: Test features/coordinates
        :return: Tuple of (predictions, lower_bounds, upper_bounds)
        """
        if self.q_hat is None:
            raise ValueError("Model must be fitted with calibration data before prediction.")
            
        preds = self.base_model.predict(X_test)
        
        lower_bounds = preds - self.q_hat
        upper_bounds = preds + self.q_hat
        
        # PM2.5 can't be negative, so we clip the lower bounds to 0
        lower_bounds = np.maximum(lower_bounds, 0)
        
        return preds, lower_bounds, upper_bounds

def print_predictions_with_intervals(preds, lower_bounds, upper_bounds, confidence_level=90):
    """
    Utility function to format and print predictions with their conformal intervals.
    """
    for i, (pred, lb, ub) in enumerate(zip(preds, lower_bounds, upper_bounds)):
        print(f"Predicted PM2.5 = {pred:.2f}, expected range {lb:.2f}–{ub:.2f}, ~{confidence_level}% interval")
