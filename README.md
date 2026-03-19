LLM workflow:
code → LLMRequest → Gateway → Provider Config → OpenAI SDK
                                              → Anthropic SDK
         ← LLMResponse ← Gateway ← Provider Config ←

Go  ->  Python : User's phone -> Go API (auth+router) → HTTP request → Python AI Service (generate plan)
                                                                                        ← HTTP respond ←