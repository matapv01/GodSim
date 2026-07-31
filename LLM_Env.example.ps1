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

# ---- YouTube streaming BGM (town-frontend) ----
# Vite reads these at build time (npx vite build). Each var takes a full
# YouTube link or a plain 11-char video ID. The video must allow embedding.
#   VITE_BGM_YOUTUBE_DAY  -> daytime
#   VITE_BGM_YOUTUBE_DUSK -> dawn / sunset
#   VITE_BGM_YOUTUBE_NIGHT-> night
#   VITE_BGM_YOUTUBE_WORK -> office / work scene
# Set VITE_BGM_STREAM_ENABLED to "true" to stream from YouTube instead of
# the local mp3 files. Set the same vars in Vercel (Environment Variables,
# Production) and redeploy for the live site.
$env:VITE_BGM_STREAM_ENABLED = "false"
$env:VITE_BGM_YOUTUBE_DAY = ""
$env:VITE_BGM_YOUTUBE_DUSK = ""
$env:VITE_BGM_YOUTUBE_NIGHT = ""
$env:VITE_BGM_YOUTUBE_WORK = ""
