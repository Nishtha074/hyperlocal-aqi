import numpy as np
try:
    from pykrige.ok import OrdinaryKriging
except ImportError:
    OrdinaryKriging = None

from src.spatial.baseline_models import SpatialInterpolator

class KrigingInterpolator(SpatialInterpolator):
    """
    Ordinary Kriging Interpolation using PyKrige.
    """
    def __init__(self, variogram_model='spherical'):
        self.variogram_model = variogram_model
        self.model = None
        self.is_fitted = False
        
        if OrdinaryKriging is None:
            raise ImportError("The 'pykrige' package is required for Kriging. Please run: pip install pykrige")

    def fit(self, coords, values):
        """
        Fits the Ordinary Kriging model.
        :param coords: Array-like of shape (n_samples, 2) [latitude, longitude]
        :param values: Array-like of shape (n_samples,) values to interpolate
        """
        lats = np.array([c[0] for c in coords])
        lons = np.array([c[1] for c in coords])
        
        # PyKrige takes x (longitude), y (latitude)
        self.model = OrdinaryKriging(
            x=lons, 
            y=lats, 
            z=np.array(values),
            variogram_model=self.variogram_model,
            verbose=False,
            enable_plotting=False
        )
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
        
        target_coords = np.array(target_coords)
        target_lats = target_coords[:, 0]
        target_lons = target_coords[:, 1]
        
        # PyKrige 'execute' takes style='points' for arrays of x and y
        z_pred, ss_pred = self.model.execute('points', target_lons, target_lats)
        return z_pred.data
