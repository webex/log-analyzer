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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import dotenv
dotenv.load_dotenv()
# Constants
OPENSEARCH_SERVICE = "es"
OPENSEARCH_SERVERLESS_SERVICE = "aoss"

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
        'timeout': 300,  # Request timeout in seconds (5 minutes) for large queries
        'connection_timeout': 30,  # Connection timeout in seconds
    }

    # 1. Try OAuth authentication
    oauth_token = os.getenv("OPENSEARCH_OAUTH_TOKEN", "")

    if oauth_token:
        logger.info("Using provided OAuth token for authentication")
        client_kwargs['http_auth'] = None
        client_kwargs['headers'] = {
            'Authorization': f'Bearer {oauth_token}'
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
