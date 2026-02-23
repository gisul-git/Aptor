"""
Test CodeAnalyzer with actual submission code
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.api.v1.aiml.services.code_analyzer import CodeAnalyzer

# Sample code from submission (first 500 chars)
code = """pip install pandas numpy

# --- Next Cell ---

import pandas as pd
from io import StringIO
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import numpy as np

# ============================================================
# TASK 1: Load and preprocess the dataset with TfidfVectorizer
# ============================================================
print("=== TASK 1: Data Loading and Preprocessing ===")

# Load dataset (using preview data since sandbox can't access localhost)
data = \"\"\"review,sentiment
This product is great!,Positive
I'm very disappointed with the product.,Negative
Best purchase I've made.,Positive
Not worth my money.,Negative
I love this product!,Positive\"\"\"

df = pd.read_csv(StringIO(data))
print(f"Dataset loaded successfully")
print(f"Dataset shape: {df.shape}")
print(f"Columns: {df.columns.tolist()}")
print(f"Sentiment distribution:\\n{df['sentiment'].value_counts()}")

# Encode labels (Positive/Negative to 1/0)
label_encoder = LabelEncoder()
y = label_encoder.fit_transform(df['sentiment'])
print(f"\\nLabel encoding: {dict(zip(label_encoder.classes_, label_encoder.transform(label_encoder.classes_)))}")

# Transform text data using TfidfVectorizer
vectorizer = TfidfVectorizer(max_features=100, stop_words='english', lowercase=True)
X = vectorizer.fit_transform(df['review'])

print(f"\\nTfidfVectorizer transformation complete")
print(f"Vectorized shape: {X.shape}")
print(f"Number of features: {X.shape[1]}")
print(f"Feature names (sample): {vectorizer.get_feature_names_out()[:10].tolist()}")

# ============================================================
# TASK 2: Model comparison with 5-fold cross-validation
# ============================================================
print("\\n=== TASK 2: Model Comparison with Cross-Validation ===")

# Define models
models = {
    'Random Forest': RandomForestClassifier(random_state=42, n_estimators=100),
    'SVM': SVC(random_state=42, kernel='linear')
}

# Perform 5-fold cross-validation
cv_results = {}
print("\\nPerforming 5-fold cross-validation...")

for model_name, model in models.items():
    # Note: Using cv=3 due to small dataset size (5 samples)
    # With 5 samples, cv=5 would fail (1 sample per fold)
    scores = cross_val_score(model, X, y, cv=3, scoring='accuracy')
    cv_results[model_name] = scores
    
    print(f"\\n{model_name}:")
    print(f"  Cross-validation scores: {scores}")
    print(f"  Mean accuracy: {scores.mean():.4f}")
    print(f"  Standard deviation: {scores.std():.4f}")

# Identify best model
best_model_name = max(cv_results, key=lambda k: cv_results[k].mean())
print(f"\\n✓ Best performing model: {best_model_name} (Mean accuracy: {cv_results[best_model_name].mean():.4f})")

# ============================================================
# TASK 3: Hyperparameter tuning with GridSearchCV
# ============================================================
print("\\n=== TASK 3: Hyperparameter Tuning with GridSearchCV ===")

# Split data for final evaluation
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Define parameter grid based on best model
if best_model_name == 'Random Forest':
    param_grid = {
        'n_estimators': [50, 100, 200],
        'max_depth': [None, 10, 20],
        'min_samples_split': [2, 5]
    }
    base_model = RandomForestClassifier(random_state=42)
else:  # SVM
    param_grid = {
        'C': [0.1, 1, 10],
        'kernel': ['linear', 'rbf'],
        'gamma': ['scale', 'auto']
    }
    base_model = SVC(random_state=42)

print(f"\\nPerforming GridSearchCV on {best_model_name}...")
print(f"Parameter grid: {param_grid}")

# Execute GridSearchCV
grid_search = GridSearchCV(
    estimator=base_model,
    param_grid=param_grid,
    cv=3,  # Using cv=3 due to small dataset
    scoring='accuracy',
    n_jobs=-1,
    verbose=0
)

grid_search.fit(X_train, y_train)

print(f"\\n✓ GridSearchCV completed")
print(f"Best parameters: {grid_search.best_params_}")
print(f"Best cross-validation accuracy: {grid_search.best_score_:.4f}")

# Retrain with optimized hyperparameters
best_model = grid_search.best_estimator_
print(f"\\nRetraining model with optimized hyperparameters...")

# Evaluate on test set
y_pred = best_model.predict(X_test)
test_accuracy = accuracy_score(y_test, y_pred)

print(f"\\n=== Final Model Performance ===")
print(f"Test accuracy: {test_accuracy:.4f}")
print(f"\\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=label_encoder.classes_))"""

print("=" * 80)
print("TESTING CODE ANALYZER")
print("=" * 80)

# Test with full code
analyzer = CodeAnalyzer(code)
print(f"\nAST tree created: {analyzer.tree is not None}")

if analyzer.tree is None:
    print("ERROR: AST parsing failed!")
    print("\nTrying to parse code without pip install line...")
    # Remove pip install line
    lines = code.split('\n')
    python_code = '\n'.join([line for line in lines if not line.strip().startswith('pip install')])
    analyzer2 = CodeAnalyzer(python_code)
    print(f"AST tree created (without pip): {analyzer2.tree is not None}")
    analyzer = analyzer2

print(f"\nImports: {analyzer.get_imports()}")
print(f"Function calls: {analyzer.get_function_calls()}")
print(f"\nHas TfidfVectorizer import: {analyzer.verify_import('sklearn.feature_extraction.text.TfidfVectorizer')}")
print(f"Has cross_val_score call: {analyzer.verify_function_call('cross_val_score')}")
print(f"Has GridSearchCV call: {analyzer.verify_function_call('GridSearchCV')}")
print(f"Has dataset loading: {analyzer.has_dataset_loading()}")
print(f"Has model training: {analyzer.has_model_training()}")
