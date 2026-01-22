# Copyright OpenSearch Contributors
# SPDX-License-Identifier: Apache-2.0

from opensearchpy import OpenSearch, RequestsHttpConnection
from urllib.parse import urlparse
from requests_aws4auth import AWS4Auth
import os
import boto3
import logging
import requests
import base64
from typing import Dict, Any, Optional
import requests
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import dotenv
dotenv.load_dotenv()
# Constants
OPENSEARCH_SERVICE = "es"
OPENSEARCH_SERVERLESS_SERVICE = "aoss"


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
        
        logger.info(f"Bearer token URL: {payload}")
        logger.info("Requesting bearer token from identity broker")
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        token_data = response.json()
        logger.info(token_data)
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
        
        print(access_token)
        
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

def get_opensearch_oauth_token():
    bearer_token = _get_bearer_token(oauth_name, oauth_password, oauth_bearer_token_url)
    if bearer_token:
        access_token = _get_oauth_access_token(bearer_token, oauth_client_id, oauth_client_secret, oauth_scope, oauth_token_url)
        if access_token:
            os.environ["OPENSEARCH_OAUTH_TOKEN"] = access_token
            logger.info("OAuth authentication successful")

# This file should expose the OpenSearch py client
def initialize_client(opensearch_url: str) -> OpenSearch:
    """
    Initialize and return an OpenSearch client with appropriate authentication.
    
    The function attempts to authenticate in the following order:
    1. OAuth authentication using company identity broker
    2. Basic authentication using OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD
    3. AWS IAM authentication using boto3 credentials
       - Uses 'aoss' service name if OPENSEARCH_SERVERLESS=true
       - Uses 'es' service name otherwise

    Args:
        opensearch_url (str): The URL of the OpenSearch cluster. Must be a non-empty string.
    
    Returns:
        OpenSearch: An initialized OpenSearch client instance.
    
    Raises:
        ValueError: If opensearch_url is empty or invalid
        RuntimeError: If no valid authentication method is available
    """
    if not opensearch_url:
        raise ValueError("OpenSearch URL cannot be empty")

    opensearch_username = os.getenv("OPENSEARCH_USERNAME", "")
    opensearch_password = os.getenv("OPENSEARCH_PASSWORD", "")
    
    # Check if using OpenSearch Serverless
    is_serverless = os.getenv("AWS_OPENSEARCH_SERVERLESS", "").lower() == "true"
    service_name = OPENSEARCH_SERVERLESS_SERVICE if is_serverless else OPENSEARCH_SERVICE
    
    if is_serverless:
        logger.info("Using OpenSearch Serverless with service name: aoss")

    # Parse the OpenSearch domain URL
    parsed_url = urlparse(opensearch_url)

    # Common client configuration
    client_kwargs: Dict[str, Any] = {
        'hosts': [opensearch_url],
        'use_ssl': (parsed_url.scheme == "https"),
        'verify_certs': True,
        'connection_class': RequestsHttpConnection,
        'timeout': 1000,  # Request timeout in seconds (5 minutes) for large queries
        'connection_timeout': 1000,  # Connection timeout in seconds
    }

    # 1. Try OAuth authentication
    oauth_token = os.getenv("OPENSEARCH_OAUTH_TOKEN", "")

    if oauth_token:
        logger.info("Using provided OAuth token for authentication")
        client_kwargs['http_auth'] = None
        client_kwargs['headers'] = {
            'Authorization': f'Bearer {oauth_token}'
        }
        try:
            return OpenSearch(**client_kwargs)
        except Exception as e:
            from mcp_server_opensearch import get_opensearch_oauth_token
            get_opensearch_oauth_token()
            client_kwargs['headers'] = {
                'Authorization': f'Bearer {os.getenv("OPENSEARCH_OAUTH_TOKEN", "")}'
            }
            return OpenSearch(**client_kwargs)

    # 2. Try basic auth
    if opensearch_username and opensearch_password:
        client_kwargs['http_auth'] = (opensearch_username, opensearch_password)
        return OpenSearch(**client_kwargs)

    # 3. Try to get credentials (boto3 session)
    try:
        session = boto3.Session()
        credentials = session.get_credentials()
        aws_region = session.region_name or os.getenv("AWS_REGION")
        if not aws_region:
            raise RuntimeError("AWS region not found, please specify region using `aws configure`")
        if credentials:
            aws_auth = AWS4Auth(
                refreshable_credentials=credentials,
                service=service_name,
                region=aws_region,
            )
            client_kwargs['http_auth'] = aws_auth
            return OpenSearch(**client_kwargs)
    except (boto3.exceptions.Boto3Error, Exception) as e:
        logger.error(f"Failed to get AWS credentials: {str(e)}")

    raise RuntimeError("No valid OAuth, basic, or AWS authentication provided for OpenSearch")
