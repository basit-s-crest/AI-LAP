import re
import logging
import warnings
from typing import Optional

# Suppress Pydantic namespace conflict warnings from third-party libraries (e.g. Presidio)
warnings.filterwarnings("ignore", category=UserWarning, message='.*has conflict with protected namespace "model_".*')

logger = logging.getLogger(__name__)

# Precompiled regex patterns for fallback scrubbing if Presidio fails to initialize
EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
PHONE_REGEX = re.compile(r'(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b')
SSN_REGEX = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
IP_REGEX = re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b')
DATE_REGEX = re.compile(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b')

def scrub_pii_fallback(text: str) -> str:
    """
    Fallback regex-based PII scrubbing.
    """
    if not text:
        return text
    text = EMAIL_REGEX.sub('[EMAIL_REDACTED]', text)
    text = PHONE_REGEX.sub('[PHONE_REDACTED]', text)
    text = SSN_REGEX.sub('[SSN_REDACTED]', text)
    text = IP_REGEX.sub('[IP_REDACTED]', text)
    text = DATE_REGEX.sub('[DATE_REDACTED]', text)
    return text

_analyzer = None
_anonymizer = None
_presidio_initialized = False

def check_and_download_spacy_model(model_name: str = "en_core_web_sm"):
    import spacy
    from spacy.cli import download
    try:
        spacy.load(model_name)
    except OSError:
        logger.info("spaCy model %s not found. Downloading...", model_name)
        try:
            download(model_name)
        except Exception as e:
            logger.error("Failed to download spaCy model %s: %s", model_name, e)
            raise

def init_presidio() -> bool:
    global _analyzer, _anonymizer, _presidio_initialized
    if _presidio_initialized:
        return True
    try:
        import spacy
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider
        from presidio_anonymizer import AnonymizerEngine

        # Ensure spaCy model is downloaded
        check_and_download_spacy_model("en_core_web_sm")

        # Explicitly configure Presidio to use en_core_web_sm
        configuration = {
            "nlp_engine_name": "spacy",
            "models": [{"model_name": "en_core_web_sm", "lang_code": "en"}],
        }
        provider = NlpEngineProvider(nlp_configuration=configuration)
        nlp_engine = provider.create_engine()

        _analyzer = AnalyzerEngine(nlp_engine=nlp_engine)
        _anonymizer = AnonymizerEngine()
        _presidio_initialized = True
        logger.info("Microsoft Presidio PII Engine successfully initialized with en_core_web_sm")
        return True
    except Exception as e:
        logger.error("Failed to initialize Microsoft Presidio PII Engine: %s. Falling back to basic regex scrubbing.", e)
        return False

def scrub_pii(text: str) -> str:
    """
    Scrub PII using Microsoft Presidio (and fallback to regex if it fails to load).
    """
    if not text:
        return text

    if not _presidio_initialized:
        init_presidio()

    if not _presidio_initialized or _analyzer is None or _anonymizer is None:
        return scrub_pii_fallback(text)

    try:
        from presidio_anonymizer.entities import OperatorConfig

        # Analyze the input text for PII
        results = _analyzer.analyze(text=text, language="en")

        # Resolve conflicts where IP_ADDRESS is mistakenly recognized as a DATE_TIME
        filtered_results = []
        ip_spans = [(r.start, r.end) for r in results if r.entity_type == "IP_ADDRESS"]
        for r in results:
            if r.entity_type == "DATE_TIME":
                # Check if this DATE_TIME overlaps with any IP_ADDRESS
                overlaps_ip = any(
                    not (r.end <= ip_start or r.start >= ip_end)
                    for ip_start, ip_end in ip_spans
                )
                if overlaps_ip:
                    continue
            filtered_results.append(r)

        # Map Presidio entities to our desired [ENTITY_REDACTED] formatting
        operators = {
            "EMAIL_ADDRESS": OperatorConfig("replace", {"new_value": "[EMAIL_REDACTED]"}),
            "PHONE_NUMBER": OperatorConfig("replace", {"new_value": "[PHONE_REDACTED]"}),
            "US_SSN": OperatorConfig("replace", {"new_value": "[SSN_REDACTED]"}),
            "IP_ADDRESS": OperatorConfig("replace", {"new_value": "[IP_REDACTED]"}),
            "DATE_TIME": OperatorConfig("replace", {"new_value": "[DATE_REDACTED]"}),
            "PERSON": OperatorConfig("replace", {"new_value": "[NAME_REDACTED]"}),
            "LOCATION": OperatorConfig("replace", {"new_value": "[LOCATION_REDACTED]"}),
        }

        anonymized_result = _anonymizer.anonymize(
            text=text,
            analyzer_results=filtered_results,
            operators=operators
        )
        return anonymized_result.text
    except Exception as e:
        logger.error("Error during Presidio PII scrubbing: %s. Using basic regex fallback.", e)
        return scrub_pii_fallback(text)
