# Copy this file to LLM_Env.ps1 and fill in your own local values.
# Never share or commit LLM_Env.ps1.

# Shared OpenAI-compatible LLM endpoint for NPC chat / soul mode.
$env:AGENTSHIRE_LLM_BASE_URL = "http://your-llm-host:8080"
$env:AGENTSHIRE_LLM_API_KEY = "replace_with_your_api_key"
$env:AGENTSHIRE_LLM_MODEL = "Qwen/Qwen3-32B-AWQ"
$env:AGENTSHIRE_LLM_API_FORMAT = "openai"
$env:AGENTSHIRE_LLM_BODY_MODE = "minimal"
$env:AGENTSHIRE_LLM_THINKING = "false"

# Optional debug output.
$env:AGENTSHIRE_DEBUG = "0"
