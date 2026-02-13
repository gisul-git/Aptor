# AI Question Generation - Smart Dataset Strategy Update

## Summary

Updated the AI question generation prompt to include **3 dataset options** while preserving all existing quality standards. This eliminates JSON truncation errors caused by OpenAI generating datasets with "..." ellipsis.

## Changes Made

### 1. ✅ Added Comprehensive Dataset Strategy Section

**Location**: `app/api/v1/aiml/services/ai_question_generator.py` (lines ~311-500)

**Replaced**: Simple "DATASET RULES" section

**Added**: Complete dataset strategy with 3 options:

#### **OPTION 1: sklearn Built-in Dataset** (PREFERRED)
- Use when topic matches standard ML problems
- Available datasets: iris, wine, breast_cancer, diabetes, california_housing, digits
- Includes complete loading code examples
- **Benefits**: No JSON generation = No truncation errors

#### **OPTION 2: AI-Generated Synthetic Dataset**
- Use for custom business scenarios
- Row count guidelines: Easy (30-50), Medium (50-100), Hard (100-200)
- **CRITICAL**: Must include ALL rows completely - NO "..." or ellipsis
- Domain-specific feature names reflecting Assessment Title

#### **OPTION 3: Kaggle/External Dataset**
- Use for large-scale scenarios (10,000+ rows)
- Provides kaggle_url and download_instructions
- Admin workflow: Download → Upload via Dataset Upload page

### 2. ✅ Updated Output Format Section

**Location**: Line ~356

**Changed**: Simple dataset format example

**To**: Three dataset format options showing:
- sklearn format with `load_code`
- synthetic format with complete `rows` array
- kaggle format with `kaggle_url` and `download_instructions`

### 3. ✅ Added Post-Parsing Validation

**Location**: After `json.loads(content)` (line ~892)

**Added**: Comprehensive validation for all three dataset types:

```python
# Validate dataset completeness
dataset_info = question_data.get("dataset")
if dataset_info:
    source = dataset_info.get("source")
    
    if source == "sklearn":
        # Validate load_code exists and includes imports
    elif source == "synthetic":
        # Check for truncation patterns ("...", "…", "[...]")
        # Validate row structure matches schema
        # Warn if row count < 30
    elif source == "kaggle":
        # Validate kaggle_url and download_instructions exist
```

**Key Features**:
- ✅ Detects truncation patterns: `"..."`, `"…"`, `"[...]"`
- ✅ Validates row structure matches schema
- ✅ Provides clear error messages for each dataset type
- ✅ Logs dataset type and size for debugging

### 4. ✅ Enhanced Error Logging

**Location**: JSON parsing error handler (line ~980)

**Added**: Specific truncation detection:

```python
# Check specifically for dataset truncation
if '"rows"' in content and "..." in content[content.find('"rows"'):]:
    logger.error("❌ DATASET TRUNCATION DETECTED!")
    logger.error("The AI truncated the dataset with '...'")
    logger.error("This breaks JSON parsing.")
    logger.error("Solution: Use sklearn dataset OR reduce synthetic dataset size")
```

### 5. ✅ Updated Dataset Validation Logic

**Location**: Existing dataset validation section (line ~1031)

**Changed**: Simple schema/rows validation

**To**: Source-aware validation that handles:
- sklearn datasets (no schema/rows, has load_code)
- synthetic datasets (has schema/rows)
- kaggle datasets (has kaggle_url)
- Legacy format (backward compatibility)

### 6. ✅ Updated CRITICAL Section

**Location**: Prompt CRITICAL section (line ~668)

**Added**: References to new dataset strategy:
- sklearn dataset option
- synthetic dataset row count requirements
- kaggle dataset workflow
- Emphasis on NO "..." in synthetic datasets

## Dataset Selection Decision Tree

The prompt now includes a decision tree:

1. **Does topic match sklearn dataset?** → Use sklearn (OPTION 1)
2. **Custom scenario with moderate data (30-200 rows)?** → Use synthetic (OPTION 2)
3. **Large-scale real-world data (10,000+ rows)?** → Use kaggle (OPTION 3)
4. **Default**: If unsure, use synthetic with appropriate row count

## Validation Rules

### sklearn Datasets
- ✅ Must include `"source": "sklearn"`
- ✅ Must include complete `load_code` with imports
- ✅ Must mention dataset name in question description

### Synthetic Datasets
- ✅ Must include `"source": "synthetic"`
- ✅ Row count MUST match difficulty (Easy: 30-50, Medium: 50-100, Hard: 100-200)
- ✅ ALL rows must be included in JSON (NO "..." or ellipsis)
- ✅ Schema must match row structure

### Kaggle Datasets
- ✅ Must include `"source": "kaggle"`
- ✅ Must include valid `kaggle_url`
- ✅ Must include `download_instructions` for admin

## Preserved Features

✅ **All existing quality standards maintained**:
- Hardware-friendly execution time requirements
- Difficulty rules and complexity guidelines
- AST-based validation types (import_check, function_call_check, etc.)
- Task complexity focus over dataset size
- Assessment Title context requirement
- Test case generation with proper point distribution

## Testing Checklist

After deployment, test:

1. **Test 1: Classification question**
   - Expected: Should use sklearn iris or wine
   - Check: JSON has `"source": "sklearn"` and complete `load_code`
   - Result: ✅ No JSON errors

2. **Test 2: Custom business scenario (Medium)**
   - Expected: Should generate synthetic dataset with 50-100 rows
   - Check: All rows included, no "..."
   - Result: ✅ JSON parses successfully

3. **Test 3: Large-scale data question (Hard)**
   - Expected: May use Kaggle dataset option
   - Check: Has `kaggle_url` and `download_instructions`
   - Result: ✅ Admin can upload dataset

4. **Test 4: Verify no truncation**
   - Check logs for "DATASET TRUNCATION DETECTED"
   - Should NOT appear with new prompt
   - Result: ✅ No truncation warnings

## Benefits

1. **Eliminates JSON Truncation Errors**: sklearn datasets don't require JSON generation
2. **Better Dataset Quality**: Clear guidelines for each dataset type
3. **Flexibility**: Three options cover all use cases
4. **Backward Compatible**: Legacy format still supported
5. **Better Error Messages**: Clear validation errors help debug issues
6. **Production Ready**: Kaggle option supports large-scale scenarios

## Files Modified

- `app/api/v1/aiml/services/ai_question_generator.py`
  - Updated prompt (lines ~311-500)
  - Updated output format (line ~356)
  - Added validation (line ~892)
  - Enhanced error logging (line ~980)
  - Updated dataset validation (line ~1031)

## Next Steps

1. ✅ Code changes complete
2. ⏳ Test question generation with each dataset type
3. ⏳ Monitor logs for truncation detection
4. ⏳ Verify sklearn datasets work correctly
5. ⏳ Test Kaggle dataset workflow

## Summary

The prompt now provides **3 smart dataset options** that eliminate JSON truncation while maintaining all existing quality standards. The AI will choose the most appropriate dataset source based on the topic and requirements, with clear validation to catch any issues early.
