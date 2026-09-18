import numpy as np
import pandas as pd
from scipy.spatial.distance import cdist
from sklearn.neighbors import KNeighborsRegressor

class SpatialInterpolator:
    """Base class for spatial interpolation models."""
    def fit(self, coords, values):
        pass
    
    def predict(self, target_coords):
        pass

class NearestNeighborInterpolator(SpatialInterpolator):
    """
    Interpolates values using the closest known point (Nearest Neighbor).
    """
    def __init__(self):
        self.model = KNeighborsRegressor(n_neighbors=1, weights='uniform')
        self.is_fitted = False

    def fit(self, coords, values):
        """
        Fits the Nearest Neighbor model.
        :param coords: Array-like of shape (n_samples, 2) [latitude, longitude]
        :param values: Array-like of shape (n_samples,) values to interpolate
        """
        self.model.fit(coords, values)
        self.is_fitted = True
        return self

    def predict(self, target_coords):
        """
        Predicts values for target coordinates.
        :param target_coords: Array-like of shape (n_queries, 2)
        :return: Array-like of predicted values
        """
        if not self.is_fitted:
            raise ValueError("Model must be fitted before prediction.")
        return self.model.predict(target_coords)

class IDWInterpolator(SpatialInterpolator):
    """
    Inverse Distance Weighting (IDW) Interpolation.
    Weighting power (p) can be adjusted (default is 2).
    """
    def __init__(self, power=2.0):
        self.power = power
        self.coords = None
        self.values = None
        self.is_fitted = False

    def fit(self, coords, values):
        self.coords = np.array(coords)
        self.values = np.array(values)
        self.is_fitted = True
        return self

    def predict(self, target_coords):
        if not self.is_fitted:
            raise ValueError("Model must be fitted before prediction.")
        
        target_coords = np.array(target_coords)
        predictions = np.zeros(len(target_coords))
        
        # Calculate distances between target coordinates and known points
        dist_matrix = cdist(target_coords, self.coords, metric='euclidean')
        
        for i, dists in enumerate(dist_matrix):
            # If a point is exactly on a known station, return that station's value
            if np.any(dists == 0):
                predictions[i] = self.values[np.argmin(dists)]
            else:
                # Calculate weights and weighted sum
                weights = 1.0 / (dists ** self.power)
                predictions[i] = np.sum(weights * self.values) / np.sum(weights)
                
        return predictions

def evaluate_model(y_true, y_pred):
    """Calculates MAE and RMSE for spatial evaluation."""
    mae = np.mean(np.abs(y_true - y_pred))
    rmse = np.sqrt(np.mean((y_true - y_pred)**2))
    return {'MAE': mae, 'RMSE': rmse}
