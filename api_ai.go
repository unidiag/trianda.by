package main

import (
	llama "github.com/unidiag/go-llama"
)

func apiAskAI(ctx *ApiCtx) map[string]any {
	out := ctx.Out
	d := ctx.Data

	prompt, _ := d["prompt"].(string)
	if prompt == "" {
		out["status"] = "empty prompt"
		return out
	}

	resp, err := llamaClient.Chat(llama.ChatRequest{
		Messages: []llama.Message{
			{Role: "system", Content: "Answer concisely. Do not include reasoning or thinking steps."},
			{Role: "user", Content: prompt},
		},
		Temperature: 0.7,
		MaxTokens:   1024,
	})

	if err != nil {
		out["status"] = err.Error()
		return out
	}

	if len(resp.Choices) > 0 {
		out["answer"] = resp.Choices[0].Message.Content
	}

	return out
}
