from fastapi import FastAPI, HTTPException
import httpx
import urllib.parse
import html

app = FastAPI(title="JioSaavn Unofficial API", version="1.0")

JIOSAAVN_BASE_URL = "https://www.jiosaavn.com/api.php"

# Essential to prevent JioSaavn from blocking the request
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
}

def clean_text(text: str) -> str:
    """Removes HTML entities like &quot; from song titles."""
    if not text:
        return ""
    return html.unescape(text)

@app.get("/search")
async def search_song(query: str):
    """Searches for songs and returns a clean list of results with IDs."""
    params = {
        "__call": "search.getResults",
        "q": query,
        "_format": "json",
        "_marker": "0",
        "api_version": "4"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(JIOSAAVN_BASE_URL, params=params, headers=HEADERS)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch data from JioSaavn")
            
        data = response.json()
        
        # JioSaavn's search returns a list of songs under 'results'
        songs = data.get("results", [])
        
        clean_results = []
        for song in songs:
            clean_results.append({
                "id": song.get("id"),
                "title": clean_text(song.get("title")),
                "album": clean_text(song.get("album")),
                "singers": clean_text(song.get("singers")),
                "image": song.get("image", "").replace("150x150", "500x500") # Get HD image
            })
            
        return {"query": query, "results": clean_results}

@app.get("/song/{song_id}")
async def get_song_details(song_id: str):
    """Fetches song metadata and decrypts the media URL to provide a direct MP3 link."""
    # Step 1: Get raw song details and the encrypted media url
    details_params = {
        "__call": "song.getDetails",
        "pids": song_id,
        "_format": "json",
        "_marker": "0",
        "api_version": "4"
    }
    
    async with httpx.AsyncClient() as client:
        details_response = await client.get(JIOSAAVN_BASE_URL, params=details_params, headers=HEADERS)
        
        if details_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch data from JioSaavn")
            
        details_data = details_response.json()
        
        # JioSaavn maps the song data to the song_id key
        if song_id not in details_data:
            raise HTTPException(status_code=404, detail="Song not found")
            
        song_info = details_data[song_id]
        
        # FIX: Look inside the 'more_info' dictionary for the encrypted URL and other nested data
        more_info = song_info.get("more_info", {})
        encrypted_media_url = more_info.get("encrypted_media_url") or song_info.get("encrypted_media_url")
        
        if not encrypted_media_url:
            raise HTTPException(status_code=400, detail="No media URL found for this song")

        # Step 2: Request the decrypted token using the encrypted URL
        encoded_url = urllib.parse.quote(encrypted_media_url)
        auth_params = {
            "__call": "song.generateAuthToken",
            "url": encoded_url,
            "bitrate": "320", 
            "api_version": "4",
            "_format": "json"
        }
        
        auth_response = await client.get(JIOSAAVN_BASE_URL, params=auth_params, headers=HEADERS)
        auth_data = auth_response.json()
        
        direct_mp3_url = auth_data.get("auth_url")
        
        # Step 3: Format the final clean response
        # Using more_info fallbacks since album/singers are often nested there too
        return {
            "id": song_info.get("id"),
            "title": clean_text(song_info.get("song") or song_info.get("title")),
            "album": clean_text(more_info.get("album") or song_info.get("album")),
            "singers": clean_text(more_info.get("singers") or song_info.get("singers")),
            "year": song_info.get("year"),
            "image": song_info.get("image", "").replace("150x150", "500x500"),
            "download_url": direct_mp3_url
        }