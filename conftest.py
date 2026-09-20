import os
import sys

# Automatically insert project root directory into sys.path for pytest module collection
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
