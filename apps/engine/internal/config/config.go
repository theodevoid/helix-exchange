package config

import "github.com/caarlos0/env/v11"

type Config struct {
	NatsURL         string `env:"NATS_URL" envDefault:"nats://localhost:4222"`
	NatsMaxReconnect int    `env:"NATS_MAX_RECONNECT" envDefault:"10"`
}

func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
