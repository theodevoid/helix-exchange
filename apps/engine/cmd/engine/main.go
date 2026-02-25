package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"helix-exchange/engine/internal/app"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		cancel()
	}()

	if err := app.Run(ctx); err != nil {
		os.Exit(1)
	}
}
