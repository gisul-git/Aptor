"""
Dataset Manager - Materializes datasets from MongoDB to filesystem
"""
import os
import csv
import json
import logging
from pathlib import Path
from typing import Dict, Any, List
from bson import ObjectId

logger = logging.getLogger("backend")


class DatasetManager:
    """Manages dataset files for AIML questions."""
    
    def __init__(self, base_path: str = None):
        """
        Initialize dataset manager.
        
        Args:
            base_path: Base directory for storing dataset files. 
                      Defaults to competency/agent/data/
        """
        if base_path:
            self.base_path = Path(base_path)
        else:
            # Default: Store in agent/data directory
            current_file = Path(__file__)
            backend_dir = current_file.parent.parent.parent.parent.parent
            self.base_path = backend_dir.parent / "competency" / "agent" / "data"
        
        # Create base directory if it doesn't exist
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Dataset manager initialized: {self.base_path}")
    
    def get_dataset_path(self, question_id: str, format: str = "csv") -> str:
        """
        Get the filesystem path for a dataset.
        
        Args:
            question_id: Question ID
            format: Dataset format (csv, json, etc.)
        
        Returns:
            Absolute path to dataset file
        """
        question_dir = self.base_path / f"question_{question_id}"
        dataset_file = question_dir / f"dataset.{format}"
        return str(dataset_file)
    
    def materialize_dataset(
        self, 
        question_id: str, 
        dataset: Dict[str, Any],
        format: str = None
    ) -> str:
        """
        Materialize dataset from MongoDB to filesystem.
        
        Args:
            question_id: Question ID
            dataset: Dataset dictionary with 'schema' and 'rows'
            format: Dataset format (csv, json, etc.). If None, uses dataset['format']
        
        Returns:
            Path to created dataset file
        """
        try:
            # Get format from dataset or parameter
            if format is None:
                format = dataset.get("format", "csv")
            
            # Create directory for this question
            question_dir = self.base_path / f"question_{question_id}"
            question_dir.mkdir(parents=True, exist_ok=True)
            
            # Get schema and rows
            schema = dataset.get("schema", [])
            rows = dataset.get("rows", [])
            
            if not schema or not rows:
                logger.warning(f"Empty dataset for question {question_id}")
                return None
            
            # Create dataset file based on format
            dataset_file = question_dir / f"dataset.{format}"
            
            if format == "csv":
                self._write_csv(dataset_file, schema, rows)
            elif format == "json":
                self._write_json(dataset_file, schema, rows)
            else:
                logger.warning(f"Unsupported format: {format}, using CSV")
                dataset_file = question_dir / "dataset.csv"
                self._write_csv(dataset_file, schema, rows)
            
            logger.info(f"✅ Dataset materialized: {dataset_file}")
            return str(dataset_file)
            
        except Exception as e:
            logger.error(f"Failed to materialize dataset for question {question_id}: {str(e)}")
            return None
    
    def _write_csv(self, file_path: Path, schema: List[Dict], rows: List):
        """Write dataset as CSV file."""
        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            # Get column names from schema
            column_names = [col.get("name") for col in schema]
            
            writer = csv.writer(f)
            # Write header
            writer.writerow(column_names)
            
            # Write rows
            for row in rows:
                if isinstance(row, list):
                    # Row is already a list
                    writer.writerow(row)
                elif isinstance(row, dict):
                    # Row is a dictionary, extract values in schema order
                    writer.writerow([row.get(col) for col in column_names])
                else:
                    logger.warning(f"Unknown row format: {type(row)}")
    
    def _write_json(self, file_path: Path, schema: List[Dict], rows: List):
        """Write dataset as JSON file."""
        column_names = [col.get("name") for col in schema]
        
        # Convert rows to list of dictionaries
        json_data = []
        for row in rows:
            if isinstance(row, list):
                # Convert array to dictionary using column names
                row_dict = {column_names[i]: row[i] for i in range(len(row))}
                json_data.append(row_dict)
            elif isinstance(row, dict):
                # Already a dictionary
                json_data.append(row)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
    
    def cleanup_question_datasets(self, question_id: str):
        """Remove all datasets for a specific question."""
        try:
            question_dir = self.base_path / f"question_{question_id}"
            if question_dir.exists():
                import shutil
                shutil.rmtree(question_dir)
                logger.info(f"Cleaned up datasets for question {question_id}")
        except Exception as e:
            logger.error(f"Failed to cleanup datasets for question {question_id}: {str(e)}")
    
    def cleanup_all_datasets(self):
        """Remove all materialized datasets."""
        try:
            if self.base_path.exists():
                import shutil
                shutil.rmtree(self.base_path)
                self.base_path.mkdir(parents=True, exist_ok=True)
                logger.info("Cleaned up all datasets")
        except Exception as e:
            logger.error(f"Failed to cleanup all datasets: {str(e)}")
    
    async def materialize_test_datasets_async(self, db, test_id: str) -> Dict[str, str]:
        """
        Materialize all datasets for questions in a test (async version).
        
        Args:
            db: Async database connection
            test_id: Test ID
        
        Returns:
            Dictionary mapping question_id to dataset path
        """
        try:
            materialized = {}
            
            # Get test
            test = await db.tests.find_one({"_id": ObjectId(test_id)})
            if not test:
                logger.warning(f"Test {test_id} not found")
                return materialized
            
            # Get question IDs
            question_ids = test.get("question_ids", [])
            
            # Materialize each question's dataset
            for qid in question_ids:
                if ObjectId.is_valid(qid):
                    question = await db.questions.find_one({"_id": ObjectId(qid)})
                    if question:
                        dataset = question.get("dataset")
                        if dataset:
                            path = self.materialize_dataset(
                                str(question["_id"]),
                                dataset,
                                dataset.get("format", "csv")
                            )
                            if path:
                                materialized[str(question["_id"])] = path
            
            logger.info(f"Materialized {len(materialized)} datasets for test {test_id}")
            return materialized
            
        except Exception as e:
            logger.error(f"Failed to materialize test datasets: {str(e)}")
            return {}


# Global instance
_dataset_manager = None


def get_dataset_manager() -> DatasetManager:
    """Get or create the global dataset manager instance."""
    global _dataset_manager
    if _dataset_manager is None:
        _dataset_manager = DatasetManager()
    return _dataset_manager

