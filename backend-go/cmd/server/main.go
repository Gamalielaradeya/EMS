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
	"ems-thermal-lstm/backend-go/internal/sse"
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
	eventHub := sse.NewHub()
	svc := service.New(repo, cfg.ActiveGatewayCode, cfg.UploadDir, eventHub, service.NewTelegramClient(cfg.TelegramAPIBaseURL))
	if err := svc.BootstrapGatewayToken(ctx, cfg.GatewayToken); err != nil {
		log.Fatalf("bootstrap gateway token: %v", err)
	}

	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()
	svc.StartNotificationWorker()
	go svc.RunOfflineChecker(appCtx, cfg.OfflineCheckEvery)

	apiHandler := handler.New(svc, eventHub)
	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router.New(apiHandler, svc, cfg.FrontendOrigin, cfg.AdminToken, cfg.InternalAPIToken),
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
	appCancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	if err := svc.ShutdownNotifications(shutdownCtx); err != nil {
		log.Printf("notification shutdown failed: %v", err)
	}
}
