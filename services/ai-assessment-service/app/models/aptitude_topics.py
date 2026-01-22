"""
Aptitude Topics Data Structure
Defines the complete hierarchy for aptitude assessments:
Main Topics → Sub-topics → Question Types
"""

APTITUDE_TOPICS_STRUCTURE = {
    "QUANTITATIVE APTITUDE (Maths)": {
        "subTopics": {
            "Number Systems": [
                "Divisibility rules",
                "HCF & LCM",
                "Remainders",
                "Simplifications",
                "Surds & Indices",
            ],
            "Arithmetic": [
                "Percentages",
                "Profit & Loss",
                "Simple Interest (SI)",
                "Compound Interest (CI)",
                "Ratio & Proportion",
                "Mixtures & Alligations",
                "Time & Work",
                "Pipes & Cisterns",
                "Time, Speed, Distance",
                "Boats & Streams",
                "Averages",
            ],
            "Algebra": [
                "Linear equations",
                "Quadratic equations",
                "Inequalities",
                "Algebraic identities",
            ],
            "Geometry & Mensuration": [
                "2D shapes (area, perimeter)",
                "3D shapes (volume & surface area)",
                "Coordinate geometry (basics)",
            ],
            "Data Interpretation (DI)": [
                "Bar graphs",
                "Pie charts",
                "Tables",
                "Line graphs",
            ],
        }
    },
    "LOGICAL REASONING (LR)": {
        "subTopics": {
            "Analytical Reasoning": [
                "Blood relations",
                "Directions",
                "Coding–Decoding",
                "Ranking tests",
                "Syllogisms",
                "Logical sequences",
                "Analogies",
            ],
            "Puzzles": [
                "Seating arrangements (linear, circular)",
                "Floor puzzles",
                "Box puzzles",
                "Age-based puzzles",
                "Scheduling puzzles",
            ],
            "Non-Verbal Reasoning": [
                "Pattern completion",
                "Series (figure-based)",
                "Mirror & water images",
            ],
        }
    },
    "VERBAL ABILITY (English)": {
        "subTopics": {
            "Grammar": [
                "Parts of speech",
                "Subject–verb agreement",
                "Tenses",
                "Active/passive voice",
                "Direct/indirect speech",
            ],
            "Vocabulary": [
                "Synonyms",
                "Antonyms",
                "Fill in the blanks",
                "Idioms & phrases",
                "One-word substitutions",
            ],
            "Reading Comprehension (RC)": [
                "Fact-based questions",
                "Inference-based questions",
                "Main idea / central theme",
                "Tone & attitude",
                "Vocabulary in context",
                "Assumption-based questions",
                "Purpose of the passage",
                "Strengthen / weaken argument",
                "True / false / cannot say",
                "Critical reasoning in RC",
            ],
            "Sentence Correction": [
                "Error spotting",
                "Parajumbles",
                "Sentence improvement",
            ],
        }
    },
}

# Main topics list
APTITUDE_MAIN_TOPICS = list(APTITUDE_TOPICS_STRUCTURE.keys())

# Helper functions
def get_aptitude_subtopics(main_topic: str) -> list:
    """Get all sub-topics for a given main topic."""
    if main_topic in APTITUDE_TOPICS_STRUCTURE:
        return list(APTITUDE_TOPICS_STRUCTURE[main_topic]["subTopics"].keys())
    return []


def get_aptitude_question_types(main_topic: str, sub_topic: str) -> list:
    """Get all question types for a given main topic and sub-topic."""
    if main_topic in APTITUDE_TOPICS_STRUCTURE:
        sub_topics = APTITUDE_TOPICS_STRUCTURE[main_topic]["subTopics"]
        if sub_topic in sub_topics:
            return sub_topics[sub_topic]
    return []


def is_aptitude_main_topic(topic_name: str) -> bool:
    """Check if a topic name is one of the aptitude main topics."""
    return topic_name in APTITUDE_MAIN_TOPICS

