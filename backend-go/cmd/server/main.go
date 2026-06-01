package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ems-thermal-lstm/backend-go/internal/config"
	"ems-thermal-lstm/backend-go/internal/database"
	"ems-thermal-lstm/backend-go/internal/handler"
	"ems-thermal-lstm/backend-go/internal/repository"
	"ems-thermal-lstm/backend-go/internal/router"
	"ems-thermal-lstm/backend-go/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load configuration: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	defer pool.Close()

	repo := repository.New(pool)
	svc := service.New(repo, cfg.ActiveGatewayCode)
	if err := svc.BootstrapGatewayToken(ctx, cfg.GatewayToken); err != nil {
		log.Fatalf("bootstrap gateway token: %v", err)
	}

	apiHandler := handler.New(svc)
	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router.New(apiHandler, svc, cfg.FrontendOrigin),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("backend listening on %s in %s mode", httpServer.Addr, cfg.Environment)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serve HTTP: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}
