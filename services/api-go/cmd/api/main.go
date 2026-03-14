package main
import(
	"log"
	"os"

	"context"

    "github.com/gin-gonic/gin"
    "github.com/joho/godotenv"
    "github.com/jackc/pgx/v5/pgxpool"

    "changenow/api-go/internal/http"
)

func main()  {
	_ = godotenv.Load();

	dbURL := os.Getenv("DATABASE_URL")

	if dbURL == "" {
		log.Fatal("DATABASE_URL is empty")
	}

	pool, err := pgxpool.New(context.TODO(),dbURL)
	if err!= nil{
		log.Fatal(err)
	}
	defer pool.Close()

	r:= gin.Default()
	http.RegisterRoutes(r,pool)

	port := os.Getenv("PORT")
	if port == ""{
		port = "8080"
	}

	log.Printf("API listening on : %s\n",port)

	_= r.Run(":" + port)
}
