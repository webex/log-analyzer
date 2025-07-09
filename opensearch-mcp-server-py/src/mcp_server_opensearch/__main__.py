# Copyright OpenSearch Contributors
# SPDX-License-Identifier: Apache-2.0

import base64
import logging
import os
from typing import Optional

import requests
from . import main

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)



def _get_bearer_token(name: str, password: str, bearer_token_url: str) -> Optional[str]:
    """
    Get a bearer token from the identity broker.
    
    Args:
        name (str): Microservice name
        password (str): Microservice password
        bearer_token_url (str): Complete URL for the bearer token endpoint
    
    Returns:
        Optional[str]: Bearer token if successful, None otherwise
    """
    try:
        url = bearer_token_url
        payload = {
            "name": name,
            "password": password
        }
        headers = {"content-type": "application/json"}
        
        logger.info("Requesting bearer token from identity broker")
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        token_data = response.json()
        bearer_token = token_data.get("BearerToken")
        
        if bearer_token:
            logger.info("Successfully obtained bearer token")
            return bearer_token
        else:
            logger.error("Bearer token not found in response")
            return None
            
    except requests.RequestException as e:
        logger.error(f"Failed to get bearer token: {str(e)}")
        return None
    except (KeyError, ValueError) as e:
        logger.error(f"Invalid response format when getting bearer token: {str(e)}")
        return None

def _get_oauth_access_token(bearer_token: str, client_id: str, client_secret: str, scope: str, oauth_url: str) -> Optional[str]:
    """
    Get an OAuth access token using the bearer token.
    
    Args:
        bearer_token (str): Bearer token from the first step
        client_id (str): OAuth client ID
        client_secret (str): OAuth client secret
        scope (str): OAuth scope
        oauth_url (str): OAuth token endpoint URL
    
    Returns:
        Optional[str]: Access token if successful, None otherwise
    """
    try:
        url = oauth_url
        
        # Create base64 encoded authorization header
        credentials = f"{client_id}:{client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        payload = {
            "grant_type": "urn:ietf:params:oauth:grant-type:saml2-bearer",
            "scope": scope,
            "assertion": bearer_token
        }
        
        headers = {
            "authorization": f"Basic {encoded_credentials}",
            "content-type": "application/x-www-form-urlencoded"
        }
        
        logger.info("Requesting OAuth access token")
        response = requests.post(url, data=payload, headers=headers)
        response.raise_for_status()
        
        token_data = response.json()
        access_token = token_data.get("access_token")
        
        if access_token:
            logger.info("Successfully obtained OAuth access token")
            return access_token
        else:
            logger.error("Access token not found in response")
            return None
            
    except requests.RequestException as e:
        logger.error(f"Failed to get OAuth access token: {str(e)}")
        return None
    except (KeyError, ValueError) as e:
        logger.error(f"Invalid response format when getting OAuth access token: {str(e)}")
        return None

oauth_name = os.getenv("OPENSEARCH_OAUTH_NAME", "")
oauth_password = os.getenv("OPENSEARCH_OAUTH_PASSWORD", "")
oauth_client_id = os.getenv("OPENSEARCH_OAUTH_CLIENT_ID", "")
oauth_client_secret = os.getenv("OPENSEARCH_OAUTH_CLIENT_SECRET", "")
oauth_scope = os.getenv("OPENSEARCH_OAUTH_SCOPE", "")
oauth_bearer_token_url = os.getenv("OPENSEARCH_OAUTH_BEARER_TOKEN_URL", "")
oauth_token_url = os.getenv("OPENSEARCH_OAUTH_TOKEN_URL", "")


logger.info("Attempting OAuth authentication")

bearer_token = _get_bearer_token(oauth_name, oauth_password, oauth_bearer_token_url)
if bearer_token:
    access_token = _get_oauth_access_token(bearer_token, oauth_client_id, oauth_client_secret, oauth_scope, oauth_token_url)
    if access_token:
        os.environ["OPENSEARCH_OAUTH_TOKEN"] = access_token
        logger.info("OAuth authentication successful")

logger.info("Starting MCP server...")
main()