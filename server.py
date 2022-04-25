import uvicorn
import os

if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5700))
    uvicorn.run("mission:app", host="0.0.0.0", port=int(PORT), reload=True, debug=True, workers=1)