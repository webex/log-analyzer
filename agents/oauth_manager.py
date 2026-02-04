"""
OAuth Token Manager for Webex Authorization Flow
Handles OAuth 2.0 token exchange and automatic token refresh
"""

import os
import time
import threading
import requests
from typing import Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OAuthTokenManager:
    """Manages OAuth tokens with automatic refresh"""
    
    # OAuth Configuration
    TOKEN_URL = "https://idbrokerbts.webex.com/idb/oauth2/v1/access_token"
    CLIENT_ID = "C01f064fa44b651f556122470b80ca0f2a5021293e9dbde4d9e1fd079d4ddc16a"
    CLIENT_SECRET = "e1c077c7d1f0505683ab177be14baee6511474f04b08628085de8b6ee36b0d2c"
    REDIRECT_URI = "http://localhost:3000"
    STATE = "set_state_here"
    
    # Token refresh interval (12 hours in seconds)
    REFRESH_INTERVAL = 12 * 60 * 60
    
    def __init__(self):
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.refresh_thread: Optional[threading.Thread] = None
        self.stop_refresh = threading.Event()
        
    def exchange_code_for_tokens(self, code: str) -> Dict[str, any]:
        """Exchange authorization code for access and refresh tokens"""
        data = {
            "grant_type": "authorization_code",
            "client_id": self.CLIENT_ID,
            "client_secret": self.CLIENT_SECRET,
            "code": code,
            "state": self.STATE,
            "redirect_uri": self.REDIRECT_URI
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        logger.info("Exchanging authorization code for tokens...")
        response = requests.post(self.TOKEN_URL, data=data, headers=headers)
        response.raise_for_status()
        
        tokens = response.json()
        logger.info(f"Successfully obtained tokens. Access token expires in {tokens.get('expires_in')} seconds")
        
        return tokens
    
    def refresh_access_token(self) -> Dict[str, any]:
        """Refresh the access token using refresh token"""
        if not self.refresh_token:
            raise ValueError("No refresh token available")
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.CLIENT_ID,
            "client_secret": self.CLIENT_SECRET
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        logger.info("Refreshing access token...")
        response = requests.post(self.TOKEN_URL, data=data, headers=headers)
        response.raise_for_status()
        
        tokens = response.json()
        logger.info("Successfully refreshed access token")
        
        return tokens
    
    def set_environment_token(self, access_token: str):
        """Set the access token in environment variable"""
        os.environ["AZURE_OPENAI_API_KEY"] = access_token
        self.access_token = access_token
        logger.info("Set AZURE_OPENAI_API_KEY environment variable")
    
    def update_tokens(self, tokens: Dict[str, any]):
        """Update tokens from API response"""
        self.access_token = tokens.get("access_token")
        self.refresh_token = tokens.get("refresh_token")
        
        # Set environment variable
        if self.access_token:
            self.set_environment_token(self.access_token)
    
    def start_token_refresh_loop(self):
        """Start background thread to refresh token every 12 hours"""
        if self.refresh_thread and self.refresh_thread.is_alive():
            logger.warning("Token refresh loop already running")
            return
        
        self.stop_refresh.clear()
        self.refresh_thread = threading.Thread(target=self._token_refresh_worker, daemon=True)
        self.refresh_thread.start()
        logger.info(f"Started token refresh loop (every {self.REFRESH_INTERVAL / 3600} hours)")
    
    def stop_token_refresh_loop(self):
        """Stop the background token refresh loop"""
        if self.refresh_thread and self.refresh_thread.is_alive():
            logger.info("Stopping token refresh loop...")
            self.stop_refresh.set()
            self.refresh_thread.join(timeout=5)
    
    def _token_refresh_worker(self):
        """Background worker that refreshes tokens periodically"""
        while not self.stop_refresh.is_set():
            # Wait for refresh interval
            if self.stop_refresh.wait(self.REFRESH_INTERVAL):
                break
            
            # Refresh token
            try:
                tokens = self.refresh_access_token()
                self.update_tokens(tokens)
                logger.info("Token refresh successful")
            except Exception as e:
                logger.error(f"Failed to refresh token: {e}")
    
    def initialize(self, authorization_code: Optional[str] = None):
        """Initialize tokens from authorization code (from env var or parameter)"""
        # Check if AZURE_OPENAI_API_KEY is already set
        existing_token = os.getenv("AZURE_OPENAI_API_KEY")
        if existing_token:
            logger.info("AZURE_OPENAI_API_KEY already set in environment, skipping OAuth initialization")
            self.access_token = existing_token
            return {"access_token": existing_token, "source": "environment"}
        
        # Get code from parameter or environment variable
        code = authorization_code or os.getenv("WEBEX_OAUTH_CODE")
        
        if not code:
            raise ValueError("Authorization code not provided. Set WEBEX_OAUTH_CODE environment variable or pass as parameter.")
        
        logger.info("Initializing OAuth with authorization code...")
        
        # Exchange code for tokens
        tokens = self.exchange_code_for_tokens(code)
        
        # Update tokens
        self.update_tokens(tokens)
        
        # Start refresh loop
        self.start_token_refresh_loop()
        
        return tokens


# Global instance
_token_manager: Optional[OAuthTokenManager] = None


def get_token_manager() -> OAuthTokenManager:
    """Get or create the global token manager instance"""
    global _token_manager
    if _token_manager is None:
        _token_manager = OAuthTokenManager()
    return _token_manager


if __name__ == "__main__":
    # Run OAuth token manager
    manager = get_token_manager()
    
    print("=" * 60)
    print("OAuth Token Manager")
    print("=" * 60)
    
    # Check for authorization code
    code = os.getenv("WEBEX_OAUTH_CODE")
    if not code:
        print("\n✗ Error: WEBEX_OAUTH_CODE environment variable not set")
        print("\nPlease set the authorization code:")
        print("  export WEBEX_OAUTH_CODE='your_code_here'")
        exit(1)
    
    try:
        print("\nInitializing OAuth flow...")
        tokens = manager.initialize()
        
        print("\n" + "=" * 60)
        print("✓ Successfully obtained tokens!")
        print("=" * 60)
        print(f"\nAccess Token: {tokens['access_token'][:50]}...")
        print(f"Refresh Token: {tokens['refresh_token'][:50]}...")
        print(f"Token Type: {tokens['token_type']}")
        print(f"Expires In: {tokens['expires_in']} seconds ({tokens['expires_in'] / 3600:.1f} hours)")
        print(f"Scope: {tokens['scope']}")
        print("\n✓ AZURE_OPENAI_API_KEY environment variable has been set")
        print("✓ Token refresh loop started (will refresh every 12 hours)")
        
        # Keep the script running to maintain the refresh loop
        print("\nPress Ctrl+C to exit...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping token refresh loop...")
            manager.stop_token_refresh_loop()
            print("Goodbye!")
            
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
