"""
OAuth Token Manager for Webex Authorization Flow using Machine Account
Handles OAuth 2.0 token exchange with machine account authentication and automatic token refresh
"""

import os
import time
import threading
import requests
import base64
from typing import Dict, Optional
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OAuthTokenManagerMachine:
    """Manages OAuth tokens with machine account authentication and automatic refresh"""
    
    def __init__(self):
        # Load configuration from environment variables
        self.IDENTITY_BROKER_URL = os.getenv("LLM_OAUTH_IDENTITY_BROKER_URL", "https://idbrokerbts.webex.com")
        self.ENVIRONMENT = os.getenv("LLM_OAUTH_ENVIRONMENT", "BTS")
        self.ORG_ID = os.getenv("LLM_OAUTH_ORG_ID", "")
        self.MACHINE_ACCOUNT_NAME = os.getenv("LLM_OAUTH_MACHINE_ACCOUNT_NAME", "")
        self.MACHINE_ACCOUNT_UUID = os.getenv("LLM_OAUTH_MACHINE_ACCOUNT_UUID", "")
        self.MACHINE_ACCOUNT_PASSWORD = os.getenv("LLM_OAUTH_MACHINE_ACCOUNT_PASSWORD", "")
        self.CLIENT_ID = os.getenv("LLM_OAUTH_CLIENT_ID", "")
        self.CLIENT_SECRET = os.getenv("LLM_OAUTH_CLIENT_SECRET", "")
        self.SCOPE = os.getenv("LLM_OAUTH_SCOPE", "spark:all spark:kms")
        
        # Constructed endpoints
        self.BEARER_TOKEN_ENDPOINT = f"{self.IDENTITY_BROKER_URL}/idb/token/{self.ORG_ID}/v2/actions/GetBearerToken/invoke"
        self.OAUTH_TOKEN_URL = f"{self.IDENTITY_BROKER_URL}/idb/oauth2/v1/access_token"
        
        # Token refresh buffer - refresh 5 minutes before expiry
        self.REFRESH_BUFFER_SECONDS = 300
        
        # Token state
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.bearer_token: Optional[str] = None
        self.token_expires_in: Optional[int] = None
        self.refresh_token_expires_in: Optional[int] = None
        self.account_expiration: Optional[int] = None
        self.refresh_thread: Optional[threading.Thread] = None
        self.stop_refresh = threading.Event()
    
    def get_bearer_token(self) -> str:
        """
        Get a bearer token from the identity broker using machine account credentials.
        
        Returns:
            str: Bearer token
            
        Raises:
            Exception: If bearer token retrieval fails
        """
        payload = {
            "name": self.MACHINE_ACCOUNT_NAME,
            "password": self.MACHINE_ACCOUNT_PASSWORD
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        logger.info(f"Requesting bearer token from identity broker for machine account: {self.MACHINE_ACCOUNT_NAME}")
        logger.info(f"Bearer token endpoint: {self.BEARER_TOKEN_ENDPOINT}")
        
        response = requests.post(self.BEARER_TOKEN_ENDPOINT, json=payload, headers=headers)
        response.raise_for_status()
        
        token_data = response.json()
        bearer_token = token_data.get("BearerToken")
        
        if not bearer_token:
            raise ValueError("Bearer token not found in response")
        
        logger.info("Successfully obtained bearer token from identity broker")
        self.bearer_token = bearer_token
        return bearer_token
    
    def exchange_bearer_for_oauth_tokens(self, bearer_token: str) -> Dict[str, any]:
        """
        Exchange bearer token for OAuth access and refresh tokens.
        
        Args:
            bearer_token (str): Bearer token from identity broker
            
        Returns:
            Dict[str, any]: Token response containing access_token, refresh_token, etc.
        """
        # Create base64 encoded authorization header
        credentials = f"{self.CLIENT_ID}:{self.CLIENT_SECRET}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:saml2-bearer",
            "scope": self.SCOPE,
            "assertion": bearer_token
        }
        
        headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        logger.info("Exchanging bearer token for OAuth tokens...")
        response = requests.post(self.OAUTH_TOKEN_URL, data=data, headers=headers)
        logger.info(response)
        response.raise_for_status()
        
        tokens = response.json()
        logger.info(f"Successfully obtained OAuth tokens. Access token expires in {tokens.get('expires_in')} seconds")
        
        return tokens
    
    def refresh_access_token(self) -> Dict[str, any]:
        """Refresh the access token using refresh token"""
        if not self.refresh_token:
            logger.warning("No refresh token available, re-authenticating with machine account...")
            return self.authenticate_with_machine_account()
        
        # Create base64 encoded authorization header
        credentials = f"{self.CLIENT_ID}:{self.CLIENT_SECRET}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.CLIENT_ID,
            "client_secret": self.CLIENT_SECRET
        }
        
        headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        logger.info("Refreshing access token using refresh token...")
        
        try:
            response = requests.post(self.OAUTH_TOKEN_URL, data=data, headers=headers)
            response.raise_for_status()
            
            tokens = response.json()
            logger.info("Successfully refreshed access token")
            
            return tokens
        except requests.RequestException as e:
            logger.error(f"Failed to refresh token: {e}")
            logger.info("Attempting to re-authenticate with machine account...")
            return self.authenticate_with_machine_account()
    
    def authenticate_with_machine_account(self) -> Dict[str, any]:
        """
        Perform full authentication flow using machine account.
        
        Returns:
            Dict[str, any]: Token response
        """
        # Step 1: Get bearer token
        bearer_token = self.get_bearer_token()
        
        logger.info("Bearer token obtained, now exchanging for OAuth tokens...")
        logger.info(f"Bearer Token: {bearer_token[:50]}...")
        # Step 2: Exchange bearer token for OAuth tokens
        tokens = self.exchange_bearer_for_oauth_tokens(bearer_token)
        
        return tokens
    
    def set_environment_token(self, access_token: str):
        """Set the access token in environment variable"""
        os.environ["AZURE_OPENAI_API_KEY"] = access_token
        self.access_token = access_token
        logger.info("Set AZURE_OPENAI_API_KEY environment variable")
    
    def update_tokens(self, tokens: Dict[str, any]):
        """Update tokens from API response"""
        self.access_token = tokens.get("access_token")
        self.token_expires_in = tokens.get("expires_in")
        self.account_expiration = tokens.get("accountExpiration")
        
        # Update refresh token if present (might not be in all responses)
        if "refresh_token" in tokens:
            self.refresh_token = tokens.get("refresh_token")
        if "refresh_token_expires_in" in tokens:
            self.refresh_token_expires_in = tokens.get("refresh_token_expires_in")
        
        # Set environment variable
        if self.access_token:
            self.set_environment_token(self.access_token)
    
    def start_token_refresh_loop(self):
        """Start background thread to refresh token based on expiry time"""
        if self.refresh_thread and self.refresh_thread.is_alive():
            logger.warning("Token refresh loop already running")
            return
        
        self.stop_refresh.clear()
        self.refresh_thread = threading.Thread(target=self._token_refresh_worker, daemon=True)
        self.refresh_thread.start()
        
        if self.token_expires_in:
            refresh_interval = max(self.token_expires_in - self.REFRESH_BUFFER_SECONDS, 60)
            logger.info(f"Started token refresh loop (will refresh in {refresh_interval} seconds / {refresh_interval / 3600:.1f} hours)")
        else:
            logger.info("Started token refresh loop (will refresh in 1 hour)")
    
    def stop_token_refresh_loop(self):
        """Stop the background token refresh loop"""
        if self.refresh_thread and self.refresh_thread.is_alive():
            logger.info("Stopping token refresh loop...")
            self.stop_refresh.set()
            self.refresh_thread.join(timeout=5)
    
    def _token_refresh_worker(self):
        """Background worker that refreshes tokens periodically based on expiry"""
        while not self.stop_refresh.is_set():
            # Calculate refresh interval (expires_in - buffer)
            if self.token_expires_in:
                refresh_interval = max(self.token_expires_in - self.REFRESH_BUFFER_SECONDS, 60)
            else:
                refresh_interval = 3600  # Default to 1 hour if no expiry info
            
            logger.info(f"Token will be refreshed in {refresh_interval} seconds ({refresh_interval / 3600:.1f} hours)")
            
            # Wait for refresh interval
            if self.stop_refresh.wait(refresh_interval):
                break
            
            # Refresh token
            try:
                logger.info("Refreshing access token...")
                tokens = self.refresh_access_token()
                self.update_tokens(tokens)
                logger.info("Token refresh successful")
            except Exception as e:
                logger.error(f"Failed to refresh token: {e}")
                # Retry after 1 minute on error
                if not self.stop_refresh.wait(60):
                    continue
    
    def initialize(self) -> Dict[str, any]:
        """Initialize tokens using machine account authentication"""
        # Check if AZURE_OPENAI_API_KEY is already set
        existing_token = os.getenv("AZURE_OPENAI_API_KEY")
        if existing_token:
            logger.info("AZURE_OPENAI_API_KEY already set in environment, skipping OAuth initialization")
            self.access_token = existing_token
            return {"access_token": existing_token, "source": "environment"}
        
        logger.info("Initializing OAuth with machine account authentication...")
        logger.info(f"Environment: {self.ENVIRONMENT}")
        logger.info(f"Organization ID: {self.ORG_ID}")
        logger.info(f"Machine Account: {self.MACHINE_ACCOUNT_NAME}")
        logger.info(f"Machine Account UUID: {self.MACHINE_ACCOUNT_UUID}")
        
        # Authenticate with machine account
        tokens = self.authenticate_with_machine_account()
        
        # Update tokens
        self.update_tokens(tokens)
        
        # Start refresh loop
        self.start_token_refresh_loop()
        
        return tokens


# Global instance
_token_manager_machine: Optional[OAuthTokenManagerMachine] = None


def get_token_manager_machine() -> OAuthTokenManagerMachine:
    """Get or create the global machine account token manager instance"""
    global _token_manager_machine
    if _token_manager_machine is None:
        _token_manager_machine = OAuthTokenManagerMachine()
    return _token_manager_machine


if __name__ == "__main__":
    # Run OAuth token manager with machine account
    manager = get_token_manager_machine()
    
    print("=" * 60)
    print("OAuth Token Manager - Machine Account Authentication")
    print("=" * 60)
    print(f"\nEnvironment: {manager.ENVIRONMENT}")
    print(f"Organization ID: {manager.ORG_ID}")
    print(f"Machine Account: {manager.MACHINE_ACCOUNT_NAME}")
    print(f"Machine Account UUID: {manager.MACHINE_ACCOUNT_UUID}")
    
    try:
        print("\nInitializing OAuth flow with machine account...")
        tokens = manager.initialize()
        
        print("\n" + "=" * 60)
        print("✓ Successfully obtained tokens!")
        print("=" * 60)
        print(f"\nAccess Token: {tokens['access_token'][:50]}...")
        if tokens.get('refresh_token'):
            print(f"Refresh Token: {tokens['refresh_token'][:50]}...")
        print(f"Token Type: {tokens.get('token_type', 'N/A')}")
        print(f"Expires In: {tokens.get('expires_in', 'N/A')} seconds ({tokens.get('expires_in', 0) / 3600:.1f} hours)")
        print(f"Scope: {tokens.get('scope', 'N/A')}")
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
