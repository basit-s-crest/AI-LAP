import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

import pytest
from unittest.mock import AsyncMock, patch
from app.modules.change_detection.services import parse_llm_json, run_session_comparison

def test_parse_llm_json_clean():
    raw_json = '{"summary": "Test Summary", "improvements": [], "concerns": [], "goals": [], "behavioralPatterns": [], "safetyFlags": []}'
    parsed = parse_llm_json(raw_json)
    assert parsed["summary"] == "Test Summary"
    assert isinstance(parsed["improvements"], list)

def test_parse_llm_json_markdown():
    raw_json_md = '```json\n{"summary": "Markdown Summary", "improvements": [], "concerns": [], "goals": [], "behavioralPatterns": [], "safetyFlags": []}\n```'
    parsed = parse_llm_json(raw_json_md)
    assert parsed["summary"] == "Markdown Summary"

def test_parse_llm_json_invalid():
    raw_invalid = 'this is not json'
    parsed = parse_llm_json(raw_invalid)
    assert parsed["summary"] == "Unable to parse comparison results."
    assert len(parsed["concerns"]) == 1
    assert parsed["concerns"][0]["area"] == "Parsing Error"

@pytest.mark.asyncio
@patch("app.modules.change_detection.services.Agent")
async def test_run_session_comparison_success(mock_agent_class):
    # Mock Agent behavior
    mock_agent_instance = AsyncMock()
    mock_agent_class.return_value = mock_agent_instance
    
    llm_response = (
        '{"summary": "Member has shown major improvement in sleep patterns.", '
        '"improvements": [{"area": "Sleep", "details": "Sleep duration increased to 7 hours."}], '
        '"concerns": [], "goals": [], "behavioralPatterns": ["Consistent routine"], "safetyFlags": []}'
    )
    mock_agent_instance.invoke_async.return_value = llm_response
    
    note_a = {"summary": "Note A", "keyThemes": [], "sentiment": "Neutral", "coachObservations": "", "recommendedFollowUp": ""}
    note_b = {"summary": "Note B", "keyThemes": [], "sentiment": "Neutral", "coachObservations": "", "recommendedFollowUp": ""}
    
    result = await run_session_comparison(note_a, note_b)
    
    assert result["summary"] == "Member has shown major improvement in sleep patterns."
    assert len(result["improvements"]) == 1
    assert result["improvements"][0]["area"] == "Sleep"
    assert result["hasSafetyAlert"] is False

@pytest.mark.asyncio
@patch("app.modules.change_detection.services.Agent")
async def test_run_session_comparison_safety_trigger(mock_agent_class):
    mock_agent_instance = AsyncMock()
    mock_agent_class.return_value = mock_agent_instance
    
    # LLM returned no safety flags
    llm_response = (
        '{"summary": "Worsening symptoms.", "improvements": [], "concerns": [], "goals": [], "behavioralPatterns": [], "safetyFlags": []}'
    )
    mock_agent_instance.invoke_async.return_value = llm_response
    
    note_a = {"summary": "Note A", "keyThemes": [], "sentiment": "Neutral", "coachObservations": "", "recommendedFollowUp": ""}
    # Note B contains a crisis keyword
    note_b = {"summary": "I am feeling extremely hopeless and have thoughts of self-harm.", "keyThemes": [], "sentiment": "Neutral", "coachObservations": "", "recommendedFollowUp": ""}
    
    result = await run_session_comparison(note_a, note_b)
    
    assert result["hasSafetyAlert"] is True
    assert len(result["safetyFlags"]) == 1
    assert result["safetyFlags"][0]["flag"] == "Potential Crisis Language"
