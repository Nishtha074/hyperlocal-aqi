import numpy as np
import pytest
from src.spatial.baseline_models import NearestNeighborInterpolator, IDWInterpolator, evaluate_model

def test_nearest_neighbor():
    coords = np.array([[0, 0], [10, 10]])
    values = np.array([50, 100])
    
    model = NearestNeighborInterpolator()
    model.fit(coords, values)
    
    # query near the first point
    preds = model.predict([[1, 1], [9, 9]])
    assert preds[0] == 50
    assert preds[1] == 100

def test_idw_interpolator():
    coords = np.array([[0, 0], [10, 0], [0, 10], [10, 10]])
    values = np.array([10, 20, 30, 40])
    
    model = IDWInterpolator(power=2)
    model.fit(coords, values)
    
    # Exact point should return exact value
    preds_exact = model.predict([[0, 0]])
    assert preds_exact[0] == 10
    
    # Midpoint should be average of all 4 points due to equal distance
    preds_mid = model.predict([[5, 5]])
    assert np.isclose(preds_mid[0], 25.0)

def test_evaluation():
    y_true = np.array([10, 20, 30])
    y_pred = np.array([12, 18, 30])
    
    metrics = evaluate_model(y_true, y_pred)
    # Errors: 2, 2, 0 -> MAE = 4/3 = 1.33
    # RMSE = sqrt((4 + 4 + 0)/3) = sqrt(8/3) = 1.63299
    assert np.isclose(metrics['MAE'], 4.0 / 3.0)
    assert np.isclose(metrics['RMSE'], np.sqrt(8.0 / 3.0))
