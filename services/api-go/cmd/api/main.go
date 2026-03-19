package main
import(
	"log"
	"os"

	"context"

    "github.com/gin-gonic/gin"
    "github.com/joho/godotenv"
    "github.com/jackc/pgx/v5/pgxpool"

	"changenow/api-go/internal/ai"
    "changenow/api-go/internal/http"
)

func main()  {
	_ = godotenv.Load();

	//Database
	dbURL := os.Getenv("DATABASE_URL")

	if dbURL == "" {
		log.Fatal("DATABASE_URL is empty")
	}

	pool, err := pgxpool.New(context.TODO(),dbURL)
	if err!= nil{
		log.Fatal(err)
	}
	defer pool.Close()

	//AI services
	aiURL := os.Getenv("AI_SERVICE_URL")
	if aiURL == "" {
		aiURL = "http://localhost:8001"
	}
	aiClient := ai.NewClient(aiURL)


	// check if AI service is reachable at startup
	if err := aiClient.Health(context.Background()); err != nil {
		log.Printf("WARNING: AI service not reachable: %v", err)
		log.Printf("The API will start, but plan generation will fail until AI service is up")
	} else {
		log.Println("AI service connected successfully")
	}


	//Router
	r:= gin.Default()
	http.RegisterRoutes(r,pool,aiClient)

	port := os.Getenv("PORT")
	if port == ""{
		port = "8080"
	}

	log.Printf("API listening on : %s\n",port)

	_= r.Run(":" + port)
}
