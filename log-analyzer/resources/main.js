// Script for the Log Analyzer webview

(function() {
    const vscode = acquireVsCodeApi();

    // Get DOM elements
    const trackingIdInput = document.getElementById('trackingId');
    const searchBtn = document.getElementById('searchBtn');
    const resultsSection = document.getElementById('resultsSection');
    const resultsCount = document.getElementById('resultsCount');
    const resultsContent = document.getElementById('resultsContent');
    const analysisContent = document.getElementById('analysisContent');
    const mcpStatus = document.getElementById('mcpStatus');
    const statusIndicator = document.getElementById('statusIndicator');

    // Tab elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Recent Searches elements
    const recentSearchesSection = document.getElementById('recentSearchesSection');
    const recentList = document.getElementById('recentList');
    const clearAllRecentsBtn = document.getElementById('clearAllRecentsBtn');
    const backToHomeBtn = document.getElementById('backToHomeBtn');

    // Hide results section by default on load
    resultsSection.style.display = 'none';

    // State management
    let isSearching = false;
    let mcpConnected = false;
    let currentSearchResults = null;
    let currentTrackingId = null;

    // Show initial connecting state
    if (statusIndicator) {
        statusIndicator.className = 'status-dot connecting';
        document.getElementById('mcpStatus').title = 'Connecting to MCP server...';
    }

    // Event listeners
    searchBtn.addEventListener('click', handleSearch);
    trackingIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        console.log('Received message from extension:', message);
        
        switch (message.type) {
            case 'mcpStatus':
                updateMcpStatus(message.status);
                break;
            case 'searchStarted':
                setSearching(true);
                break;
            case 'searchResults':
                setSearching(false);
                currentSearchResults = message.results;
                currentTrackingId = message.trackingId;
                cacheResult(message.trackingId, message.results); // cache the results
                showResults(message.results, message.trackingId);
                // Auto-generate analysis after showing results
                generateAnalysis(message.results, message.trackingId);
                break;                    case 'searchError':
                setSearching(false);
                showError(message.error);
                break;
            case 'analysisResult':
                cacheAnalysis(message.trackingId, message.analysis); // cache analysis result
                showAnalysis(message.analysis);
                break;
            case 'analysisError':
                showAnalysisError(message.error);
                break;
        }
    });

    // Auto-focus on the input field
    trackingIdInput.focus();

    // Show landing page on load
    showLandingPage();

    // Event listeners for recents and back
    clearAllRecentsBtn.addEventListener('click', clearAllRecents);

    // Remove any previous event listeners and add a single event listener to the back button
    backToHomeBtn.onclick = () => {
        showLandingPage();
    };

    // Update showLandingPage to always hide results and show recents
    function showLandingPage() {
        recentSearchesSection.style.display = '';
        resultsSection.style.display = 'none';
        backToHomeBtn.style.display = 'none';
        renderRecentSearches();
        trackingIdInput.value = '';
        trackingIdInput.focus();
        // Reset tab to logs for next search
        switchTab('logs');
        // Optionally clear results/analysis content if you want a clean state
        resultsContent.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><path d="21 21l-4.35-4.35"></path></svg><p>Enter a tracking ID to search for logs</p></div>`;
        analysisContent.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg><p>AI analysis will appear here after searching logs</p></div>`;
    }

    function handleSearch() {
        const trackingId = trackingIdInput.value.trim();
        
        if (!trackingId) {
            showError('Please enter a tracking ID');
            return;
        }

        if (!mcpConnected) {
            showError('MCP server is not connected. Please wait or try reconnecting.');
            return;
        }

        if (isSearching) {
            return;
        }

        // Hide recents and show results UI immediately
        recentSearchesSection.style.display = 'none';
        resultsSection.style.display = '';
        backToHomeBtn.style.display = '';

        // Check cache
        const cached = getCachedResult(trackingId);
        if (cached) {
            setSearching(false);
            currentSearchResults = cached;
            currentTrackingId = trackingId;
            showResults(cached, trackingId);
            generateAnalysis(cached, trackingId);
            addRecentSearch(trackingId);
            return;
        }

        // Not cached, proceed as normal
        setSearching(true);
        vscode.postMessage({
            type: 'search',
            trackingId: trackingId
        });
        addRecentSearch(trackingId);
    }

    function updateMcpStatus(status) {
        console.log('Received MCP status update:', status);
        
        const statusIndicator = document.getElementById('statusIndicator');
        const mcpStatusContainer = document.getElementById('mcpStatus');
        
        if (!statusIndicator || !mcpStatusContainer) {
            console.error('MCP status elements not found');
            return;
        }
        
        if (status.connected) {
            statusIndicator.className = 'status-dot connected';
            mcpStatusContainer.title = `MCP Connected to ${status.serverName}`;
            mcpConnected = true;
            console.log('MCP status set to connected');
        } else {
            statusIndicator.className = 'status-dot disconnected';
            mcpStatusContainer.title = status.error || 'MCP server not connected';
            mcpConnected = false;
            console.log('MCP status set to disconnected:', status.error);
        }
        
        // Update search button state
        if (!isSearching) {
            searchBtn.disabled = !mcpConnected;
        }
    }

    function setSearching(searching) {
        isSearching = searching;
        
        if (searching) {
            searchBtn.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    Searching...
                </div>
            `;
            searchBtn.disabled = true;
            trackingIdInput.disabled = true;
            
            // Show loading in results
            resultsContent.innerHTML = `
                <div class="empty-state">
                    <div class="spinner"></div>
                    <p>Searching OpenSearch logs...</p>
                </div>
            `;
        } else {
            searchBtn.innerHTML = `
                <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="21 21l-4.35-4.35"></path>
                </svg>
                Search Logs
            `;
            searchBtn.disabled = !mcpConnected;
            trackingIdInput.disabled = false;
        }
    }

    function showResults(searchResults, trackingId) {
        const hits = searchResults.hits?.hits || [];
        const total = searchResults.hits?.total?.value || 0;
        
        resultsCount.textContent = `${total} results`;
        
        // Ensure we're on the logs tab when showing results
        switchTab('logs');
        
        if (hits.length === 0) {
            resultsContent.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="21 21l-4.35-4.35"></path>
                    </svg>
                    <p>No logs found for tracking ID: ${escapeHtml(trackingId)}</p>
                </div>
            `;
            
            // Also clear analysis content
            analysisContent.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    <p>No logs available for analysis</p>
                </div>
            `;
        } else {
            resultsContent.innerHTML = createResultsHtml(hits);
        }
    }

    function createResultsHtml(results) {
        if (!results || results.length === 0) {
            return `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="21 21l-4.35-4.35"></path>
                    </svg>
                    <p>No logs found for this tracking ID</p>
                </div>
            `;
        }

        return results.map(result => createLogItemHtml(result)).join('');
    }

    function createLogItemHtml(logEntry) {
        const source = logEntry._source;
        const fields = source.fields || {};
        
        // Extract service name from hostname or fields
        const serviceName = source.hostname || fields.nodeId || fields.localAlias || 'Unknown Service';
        const logLevel = (fields.level || source.log_level || 'INFO').toUpperCase();
        const timestamp = source['@timestamp'];
        const message = source.message || 'No message';
        const webexTrackingId = fields.WEBEX_TRACKINGID;
        
        // Create key details to show
        const keyDetails = [
            { key: 'Score', value: logEntry._score?.toFixed(2) },
            { key: 'Index', value: logEntry._index },
            { key: 'Hostname', value: source.hostname },
            { key: 'Datacenter', value: source.datacenter },
            { key: 'Environment', value: source.environment },
            { key: 'Build', value: source.buildNumber },
            { key: 'Thread', value: fields.thread_name },
            { key: 'Class', value: fields.caller_class_name },
            { key: 'Method', value: fields.caller_method_name },
            { key: 'Line', value: fields.caller_line_number }
        ].filter(detail => detail.value);

        return `
            <div class="log-item">
                <div class="log-header">
                    <div class="log-service">${escapeHtml(serviceName)}</div>
                    <div class="log-datacenter">${escapeHtml(source.datacenter || '')}</div>
                    <div class="log-level log-level-${logLevel.toLowerCase()}">${logLevel}</div>
                </div>
                <div class="log-timestamp">${formatTimestamp(timestamp)}</div>
                ${webexTrackingId ? `
                    <div class="log-tracking-id">
                        <span class="tracking-id-label">Tracking ID:</span>
                        <span class="tracking-id-value">${escapeHtml(webexTrackingId)}</span>
                    </div>
                ` : ''}
                <div class="log-message">${escapeHtml(message)}</div>
                ${keyDetails.length > 0 ? `
                    <div class="log-details">
                        ${keyDetails.map(detail => `
                            <div class="log-detail-key">${escapeHtml(detail.key)}:</div>
                            <div class="log-detail-value">${escapeHtml(detail.value)}</div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function formatTimestamp(timestamp) {
        if (!timestamp) {
            return 'Unknown time';
        }
        
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        } catch (e) {
            return timestamp;
        }
    }

    function escapeHtml(text) {
        if (!text) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError(message) {
        // Create a temporary error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            z-index: 1000;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }, 3000);
    }

    function switchTab(tabName) {
        // Update tab buttons
        tabButtons.forEach(button => {
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Update tab panels
        tabPanels.forEach(panel => {
            if (panel.id === `${tabName}Panel`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }

    function generateAnalysis(searchResults, trackingId, force = false) {
        if (!searchResults || !searchResults.hits || !searchResults.hits.hits) {
            return;
        }
        // Check for cached analysis first, unless force is true
        if (!force) {
            const cachedAnalysis = getCachedAnalysis(trackingId);
            if (cachedAnalysis) {
                showAnalysis(cachedAnalysis);
                return;
            }
        }
        // Show loading state in analysis tab
        analysisContent.innerHTML = `
            <div class="analysis-loading">
                <div class="spinner"></div>
                <p>Generating AI analysis...</p>
            </div>
        `;
        // Send request to extension for analysis
        vscode.postMessage({
            type: 'generateAnalysis',
            searchResults: searchResults,
            trackingId: trackingId
        });
    }

    function showAnalysis(analysisMarkdown) {
        analysisContent.innerHTML = `
            <div class="analysis-markdown">
                ${markdownToHtml(analysisMarkdown)}
            </div>
        `;
    }

    function showAnalysisError(error) {
        analysisContent.innerHTML = `
            <div class="analysis-error">
                <h3>Analysis Error</h3>
                <p>Failed to generate analysis: ${escapeHtml(error)}</p>
                <button onclick="regenerateAnalysis()" class="btn btn-secondary" style="margin-top: 8px;">
                    Try Again
                </button>
            </div>
        `;
    }

    function regenerateAnalysis() {
        if (currentSearchResults && currentTrackingId) {
            generateAnalysis(currentSearchResults, currentTrackingId, true); // force regeneration
        }
    }

    function markdownToHtml(markdown) {
        if (!markdown) {
            return '<p>No analysis available</p>';
        }

        // Simple markdown parser for basic formatting
        let html = markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Inline code
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Lists (improved)
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
            // Blockquotes
            .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
            // Line breaks and paragraphs
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Wrap consecutive list items in ul tags
        html = html.replace(/(<li>.*?<\/li>)/g, (match, listItems) => {
            if (!listItems.includes('<ul>')) {
                return '<ul>' + match + '</ul>';
            }
            return match;
        });

        // Clean up multiple consecutive ul tags
        html = html.replace(/<\/ul>\s*<ul>/g, '');

        // Wrap in paragraphs if not already wrapped
        if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<blockquote')) {
            html = '<p>' + html + '</p>';
        }

        return html;
    }

    // --- Recent Search Storage ---
    function getRecentSearches() {
        try {
            return JSON.parse(localStorage.getItem('recentTrackingIds') || '[]');
        } catch { return []; }
    }
    function setRecentSearches(list) {
        localStorage.setItem('recentTrackingIds', JSON.stringify(list));
    }
    function addRecentSearch(trackingId) {
        let recents = getRecentSearches();
        recents = recents.filter(id => id !== trackingId);
        recents.unshift(trackingId);
        if (recents.length > 10) recents = recents.slice(0, 10);
        setRecentSearches(recents);
        renderRecentSearches();
    }
    function removeRecentSearch(trackingId) {
        let recents = getRecentSearches().filter(id => id !== trackingId);
        setRecentSearches(recents);
        removeCachedResult(trackingId);
        renderRecentSearches();
    }
    function clearAllRecents() {
        setRecentSearches([]);
        clearAllCachedResults();
        renderRecentSearches();
        // Hide results section when all recents are cleared
        resultsSection.style.display = 'none';
    }
    function renderRecentSearches() {
        const recents = getRecentSearches();
        recentList.innerHTML = '';
        if (recents.length === 0) {
            recentList.innerHTML = '<li class="empty-recent">No recent searches</li>';
            return;
        }
        recents.forEach(trackingId => {
            const li = document.createElement('li');
            li.className = 'recent-item stylish'; // add 'stylish' for new CSS
            li.innerHTML = `
                <span class="recent-id" title="${escapeHtml(trackingId)}">${escapeHtml(trackingId)}</span>
                <button class="recent-remove" title="Remove" aria-label="Remove recent search">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="14" y2="14"/><line x1="14" y1="6" x2="6" y2="14"/></svg>
                </button>
            `;
            li.querySelector('.recent-id').addEventListener('click', () => {
                trackingIdInput.value = trackingId;
                handleSearch();
            });
            li.querySelector('.recent-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeRecentSearch(trackingId);
            });
            recentList.appendChild(li);
        });
    }

    // --- Cache Storage ---
    function normalizeTrackingId(trackingId) {
        return (trackingId || '').trim().toLowerCase();
    }
    function getCachedResult(trackingId) {
        try {
            return JSON.parse(localStorage.getItem('cache_' + normalizeTrackingId(trackingId)));
        } catch { return null; }
    }
    function cacheResult(trackingId, result) {
        localStorage.setItem('cache_' + normalizeTrackingId(trackingId), JSON.stringify(result));
    }
    function removeCachedResult(trackingId) {
        localStorage.removeItem('cache_' + normalizeTrackingId(trackingId));
    }
    function getCachedAnalysis(trackingId) {
        try {
            return JSON.parse(localStorage.getItem('analysis_' + normalizeTrackingId(trackingId)));
        } catch { return null; }
    }
    function cacheAnalysis(trackingId, analysis) {
        localStorage.setItem('analysis_' + normalizeTrackingId(trackingId), JSON.stringify(analysis));
    }
    function removeCachedAnalysis(trackingId) {
        localStorage.removeItem('analysis_' + normalizeTrackingId(trackingId));
    }
    function clearAllCachedResults() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cache_')) localStorage.removeItem(key);
        });
    }
    function clearAllCachedAnalyses() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('analysis_')) localStorage.removeItem(key);
        });
    }

    // Hide results/analysis on landing, show on search
    showLandingPage();

    // On load, render recents
    renderRecentSearches();

    // Make regenerateAnalysis globally available
    window.regenerateAnalysis = regenerateAnalysis;
})();
