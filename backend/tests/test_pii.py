from app.shared.pii import scrub_pii, scrub_pii_fallback

def test_scrub_pii_presidio():
    # Test emails
    assert "[EMAIL_REDACTED]" in scrub_pii("Contact me at test@example.com.")
    
    # Test phone numbers
    assert "[PHONE_REDACTED]" in scrub_pii("Call me at 123-456-7890.")
    
    # Test SSNs
    assert "[SSN_REDACTED]" in scrub_pii("My SSN is 218-12-3456.")
    
    # Test IPs
    assert "[IP_REDACTED]" in scrub_pii("Log in from 192.168.1.1.")
    
    # Test names
    assert "[NAME_REDACTED]" in scrub_pii("Hello, my name is Alice Smith.")
    
    # Test locations
    assert "[LOCATION_REDACTED]" in scrub_pii("I live in Chicago, Illinois.")

def test_scrub_pii_fallback():
    # Test basic regex fallbacks specifically
    text = "Emails: abc@xyz.com. Phone: 555-555-5555. SSN: 111-22-3333. IP: 10.0.0.1."
    scrubbed = scrub_pii_fallback(text)
    assert "[EMAIL_REDACTED]" in scrubbed
    assert "[PHONE_REDACTED]" in scrubbed
    assert "[SSN_REDACTED]" in scrubbed
    assert "[IP_REDACTED]" in scrubbed

def test_scrub_pii_empty():
    assert scrub_pii("") == ""
    assert scrub_pii(None) is None
