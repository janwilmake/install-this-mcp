import { generateMCPConfig, generateMCPInstallationGuide } from "./index";
import type { MCPServerCardResponse, MCPServerCard, Icon } from "./server-card";

interface MCPConfig {
  client: string;
  iconUrl?: string;
  deepLink?: string;
  remoteCommand?: string;
  instructions?: string;
  configJson?: unknown;
}

async function fetchMCPMetadata(mcpUrl: string): Promise<MCPServerCard | null> {
  const segments = mcpUrl.split("/");
  segments.pop();
  const wellKnownUrl = segments.join("/") + "/.well-known/mcp";

  try {
    const response = await fetch(wellKnownUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const data: MCPServerCardResponse = await response.json();

    // Handle array response - find matching URL
    if (Array.isArray(data)) {
      const match = data.find((card) => {
        if (!card.transport) return false;

        // Check if transport endpoint matches
        if (
          card.transport.type === "streamable-http" ||
          card.transport.type === "sse"
        ) {
          const transportUrl =
            card.transport.type === "streamable-http"
              ? new URL(card.transport.endpoint, mcpUrl).href
              : card.transport.url;
          return (
            transportUrl === mcpUrl ||
            mcpUrl.includes(card.transport.endpoint || "")
          );
        }

        return false;
      });

      return match || data[0] || null;
    }

    return data;
  } catch (error) {
    console.error("Failed to fetch MCP metadata:", error);
    return null;
  }
}

function getBestIcon(icons?: Icon[]): string | null {
  if (!icons || icons.length === 0) return null;

  // Prefer PNG or JPEG, then SVG, then WebP
  const preferred = icons.find((icon) =>
    icon.mimeType?.match(/image\/(png|jpeg|jpg)/)
  );
  if (preferred) return preferred.src;

  const svg = icons.find((icon) => icon.mimeType === "image/svg+xml");
  if (svg) return svg.src;

  return icons[0].src;
}

function generateHTML(
  mcpUrl: string,
  serverName: string,
  configs: MCPConfig[],
  selectedClient: string | null = null,
  metadata: MCPServerCard | null = null
): string {
  const apexDomain = new URL(mcpUrl).hostname
    .split(".")
    .reverse()
    .slice(0, 2)
    .reverse()
    .join(".");

  // Use metadata if available
  const displayName = metadata?.serverInfo?.title || serverName;
  const version = metadata?.serverInfo?.version;
  const websiteUrl = metadata?.serverInfo?.websiteUrl;
  const description = metadata?.description || metadata?.instructions;
  const serverIcon =
    getBestIcon(metadata?.serverInfo?.icons || metadata?.icons) ||
    `https://www.google.com/s2/favicons?domain=${apexDomain}&sz=128`;

  // Additional metadata
  const protocolVersion = metadata?.protocolVersion;
  const documentationUrl = metadata?.documentationUrl;
  const transportType = metadata?.transport?.type;
  const hasResources =
    metadata?.resources &&
    (metadata.resources === "dynamic" || metadata.resources.length > 0);
  const hasTools =
    metadata?.tools &&
    (metadata.tools === "dynamic" || metadata.tools.length > 0);
  const hasPrompts =
    metadata?.prompts &&
    (metadata.prompts === "dynamic" || metadata.prompts.length > 0);

  // Filter configs if a specific client is selected
  const displayConfigs = selectedClient
    ? configs.filter(
        (config) => config.client.toLowerCase() === selectedClient.toLowerCase()
      )
    : configs;

  const pageTitle = selectedClient
    ? `Install ${displayName} for ${selectedClient}`
    : `Install ${displayName}`;

  const pageDescription = selectedClient
    ? `Install ${displayName} MCP server for ${selectedClient}`
    : `Connect ${displayName} MCP server to any client`;

  const clientIcon = selectedClient ? displayConfigs[0]?.iconUrl : serverIcon;

  // Client list view
  if (!selectedClient) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDescription}">
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:description" content="${pageDescription}">
    <meta property="og:type" content="website">
    <meta property="og:image" content="${clientIcon}">
    <link rel="icon" type="image/png" href="${clientIcon}">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            background: #fafafa;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        }
        
        .widget-container {
            width: 100%;
            max-width: 480px;
            height: 600px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-radius: 0.5rem;
            overflow: hidden;
            background: white;
            border: 1px solid #e5e7eb;
        }
        
        .client-list {
            overflow-y: auto;
            flex: 1;
        }
        
        .client-card {
            transition: all 0.15s ease;
        }
        
        .client-card:hover {
            background-color: #f9fafb;
        }
        
        .footer-link {
            color: #6b7280;
            transition: color 0.2s;
        }
        
        .footer-link:hover {
            color: #111827;
        }

        .instructions-section {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }

        .instructions-section.expanded {
            max-height: 500px;
        }

        .metadata-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
            background: #f3f4f6;
            border-radius: 0.25rem;
            color: #6b7280;
        }

        /* Iframe mode styles */
        .iframe-mode body {
            background: white;
            padding: 0;
            min-height: auto;
        }

        .iframe-mode .widget-container {
            max-width: 100%;
            height: 100vh;
            box-shadow: none;
            border-radius: 0;
            border: none;
        }

        .iframe-mode .footer-wrapper {
            display: none;
        }

        @media (max-width: 600px) {
            body {
                background: white;
                padding: 0;
            }
            .widget-container {
                max-width: 100%;
                height: 100vh;
                box-shadow: none;
                border-radius: 0;
                border: none;
            }
            .footer-wrapper {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="widget-container">
        <!-- Header -->
        <div class="px-6 py-6 border-b border-gray-200 flex-shrink-0">
            <div class="flex items-center gap-4 mb-3">
                <img src="${serverIcon}" 
                     alt="${displayName}" 
                     class="w-12 h-12 rounded-lg"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23d1d5db%22%3E%3Cpath d=%22M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z%22/%3E%3C/svg%3E'">
                <div class="flex-1 min-w-0">
                    <h1 class="text-xl font-semibold text-gray-900 truncate">${displayName}</h1>
                    <div class="flex items-center gap-2 text-sm text-gray-500 flex-wrap mt-1">
                        ${
                          version
                            ? `<span class="metadata-badge">v${version}</span>`
                            : ""
                        }
                        ${
                          protocolVersion
                            ? `<span class="metadata-badge">MCP ${protocolVersion}</span>`
                            : ""
                        }
                        ${
                          transportType
                            ? `<span class="metadata-badge">${transportType}</span>`
                            : ""
                        }
                        ${
                          websiteUrl
                            ? `<a href="${websiteUrl}" target="_blank" class="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-xs">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                            </svg>
                            Website
                        </a>`
                            : ""
                        }
                        ${
                          documentationUrl
                            ? `<a href="${documentationUrl}" target="_blank" class="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-xs">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                            </svg>
                            Docs
                        </a>`
                            : ""
                        }
                    </div>
                </div>
            </div>
            
            ${
              hasResources || hasTools || hasPrompts
                ? `
            <div class="flex items-center gap-2 mb-3 flex-wrap">
                <span class="text-xs text-gray-600">Provides:</span>
                ${
                  hasResources
                    ? `<span class="metadata-badge">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                    Resources${
                      typeof metadata.resources === "object"
                        ? ` (${metadata.resources.length})`
                        : ""
                    }
                </span>`
                    : ""
                }
                ${
                  hasTools
                    ? `<span class="metadata-badge">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    Tools${
                      typeof metadata.tools === "object"
                        ? ` (${metadata.tools.length})`
                        : ""
                    }
                </span>`
                    : ""
                }
                ${
                  hasPrompts
                    ? `<span class="metadata-badge">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                    </svg>
                    Prompts${
                      typeof metadata.prompts === "object"
                        ? ` (${metadata.prompts.length})`
                        : ""
                    }
                </span>`
                    : ""
                }
            </div>
            `
                : ""
            }
            
            ${
              description
                ? `
            <div class="mt-3">
                <button onclick="toggleInstructions()" 
                        class="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
                    <svg id="instructions-icon" class="w-4 h-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                    <span>Description</span>
                </button>
                <div id="instructions-section" class="instructions-section mt-2 text-sm text-gray-600 whitespace-pre-wrap">${description}</div>
            </div>
            `
                : ""
            }
            <p class="text-sm text-gray-600 mt-3">Choose your client to install</p>
        </div>

        <!-- Client List -->
        <div class="client-list divide-y divide-gray-100">
            ${configs
              .map(
                (config) => `
                <div class="client-card cursor-pointer" onclick="navigateToClient('${
                  config.client
                }')">
                    <div class="px-6 py-4 flex items-center gap-4">
                        <div class="w-10 h-10"><img src="${
                          config.iconUrl
                        }" alt="${
                  config.client
                }" class="w-10 h-10 rounded-lg flex-shrink-0" onerror="this.style.display='none'"></div>
                        <span class="font-medium text-gray-900 flex-1">${
                          config.client
                        }</span>
                        ${
                          config.deepLink
                            ? `
                            <button onclick="event.stopPropagation(); window.location.href='${config.deepLink}'"
                                    class="px-3 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors flex-shrink-0">
                                Install Now
                            </button>
                        `
                            : `
                            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        `
                        }
                    </div>
                </div>
            `
              )
              .join("")}
        </div>
    </div>
    
    <div class="footer-wrapper text-center mt-6 mb-4">
        <div>
            <a href="https://github.com/janwilmake/install-this-mcp" 
            class="footer-link flex flex-row items-center gap-2 text-sm">
                <img src="https://img.shields.io/github/stars/janwilmake/install-this-mcp?style=social" alt="GitHub stars">
                <span>Installation instructions powered by install-this-mcp</span>
            </a>
        </div>

        <div>
        <a href="/${encodeURIComponent(
          serverName
        )}/guides?url=${encodeURIComponent(mcpUrl)}" 
           class="footer-link inline-flex items-center gap-2 text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
            </svg>
            <span>Want this guide into your docs or README?</span>
        </a>
        </div>
    </div>

    
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const isIframeParam = urlParams.get('iframe') === '1';
        const isSmallScreen = window.innerWidth <= 600;
        
        if (isIframeParam || isSmallScreen) {
            document.documentElement.classList.add('iframe-mode');
        }

        function toggleInstructions() {
            const section = document.getElementById('instructions-section');
            const icon = document.getElementById('instructions-icon');
            section.classList.toggle('expanded');
            icon.style.transform = section.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        function navigateToClient(clientName) {
            const iframeParam = isIframeParam ? '&iframe=1' : '';
            window.location.href = \`/${encodeURIComponent(
              serverName
            )}/for/\${encodeURIComponent(clientName)}?url=${encodeURIComponent(
      mcpUrl
    )}\${iframeParam}\`;
        }
    </script>
    <script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
</body>
</html>`;
  }

  // Client-specific view
  const currentConfig = displayConfigs[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDescription}">
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:description" content="${pageDescription}">
    <meta property="og:type" content="website">
    <meta property="og:image" content="${clientIcon}">
    <link rel="icon" type="image/png" href="${clientIcon}">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            background: #fafafa;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            overflow: hidden;
        }
        
        .widget-container {
            width: 100%;
            max-width: 480px;
            height: 600px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-radius: 0.5rem;
            overflow: hidden;
            background: white;
            border: 1px solid #e5e7eb;
        }
        
        .content-scroll {
            overflow-y: auto;
            flex: 1;
        }
        
        .tab-item {
            flex: 0 0 auto;
            opacity: 0.4;
            transition: opacity 0.2s;
        }
        
        .tab-item.active {
            opacity: 1;
        }
        
        .tab-item:hover {
            opacity: 0.7;
        }
        
        .footer-link {
            color: #6b7280;
            transition: color 0.2s;
        }
        
        .footer-link:hover {
            color: #111827;
        }

        /* Iframe mode styles */
        .iframe-mode body {
            background: white;
            padding: 0;
            min-height: auto;
            overflow: hidden;
        }

        .iframe-mode .widget-container {
            max-width: 100%;
            height: 100vh;
            box-shadow: none;
            border-radius: 0;
            border: none;
        }

        .iframe-mode .content-scroll {
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        }

        .iframe-mode .footer-wrapper {
            display: none;
        }

        @media (max-width: 600px) {
            body {
                background: white;
                padding: 0;
                overflow: hidden;
            }
            .widget-container {
                max-width: 100%;
                height: 100vh;
                box-shadow: none;
                border-radius: 0;
                border: none;
            }
            .content-scroll {
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            .footer-wrapper {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="widget-container">
        <!-- Header with Back Button -->
        <div class="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div class="flex items-center gap-3 mb-3">
                <button onclick="navigateBack()"
                        class="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                </button>
                <div class="flex-1 min-w-0">
                    <h1 class="text-lg font-semibold text-gray-900 truncate">${displayName}</h1>
                    <p class="text-sm text-gray-600">for ${selectedClient}</p>
                </div>
                <img src="${currentConfig.iconUrl}" 
                     alt="${selectedClient}" 
                     class="w-10 h-10 rounded-lg"
                     onerror="this.style.display='none'">
            </div>
        </div>

        <!-- Client Tabs -->
        <div class="bg-white border-b border-gray-200 px-4 py-2 overflow-x-auto flex-shrink-0">
            <div class="flex gap-2">
                ${configs
                  .map(
                    (config) => `
                    <button onclick="navigateToClient('${config.client}')"
                            class="tab-item ${
                              config.client === selectedClient ? "active" : ""
                            }"
                            title="${config.client}">
                        <img src="${config.iconUrl}" 
                             alt="${config.client}" 
                             class="w-8 h-8 rounded"
                             onerror="this.style.display='none'">
                    </button>
                `
                  )
                  .join("")}
            </div>
        </div>

        <!-- Installation Content -->
        <div class="content-scroll p-6">
            ${
              currentConfig.deepLink
                ? `
                <a href="${currentConfig.deepLink}" 
                   class="block w-full mb-6 px-4 py-3 bg-gray-900 text-white text-center rounded hover:bg-gray-700 transition-colors font-medium">
                    Quick Install in ${selectedClient}
                </a>
            `
                : ""
            }
            
            ${
              currentConfig.remoteCommand
                ? `
                <div class="bg-gray-900 text-green-400 p-4 rounded mb-4 font-mono text-sm">
                    <div class="flex items-center justify-between gap-2">
                        <span class="break-all flex-1">$ ${currentConfig.remoteCommand}</span>
                        <button onclick="copyText(this.previousElementSibling.textContent.trim().substring(2), this)" 
                                class="text-gray-400 hover:text-white text-xs px-2 py-1 rounded transition-colors flex-shrink-0">
                            Copy
                        </button>
                    </div>
                </div>
            `
                : ""
            }
            
            <div class="prose prose-sm max-w-none mb-4 text-gray-700">
                ${currentConfig.instructions
                  ?.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\n/g, "<br>")}
            </div>
            
            ${
              currentConfig.configJson
                ? `
                <div class="bg-gray-50 rounded border border-gray-200 p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-gray-700">Configuration</span>
                        <button onclick="copyText(this.parentElement.nextElementSibling.textContent, this)"
                                class="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded transition-colors">
                            Copy JSON
                        </button>
                    </div>
                    <pre class="text-xs text-gray-800 overflow-x-auto"><code>${JSON.stringify(
                      currentConfig.configJson,
                      null,
                      2
                    )}</code></pre>
                </div>
            `
                : ""
            }
        </div>
    </div>
    
    <div class="footer-wrapper text-center mt-6 mb-4">
        <div>
            <a href="https://github.com/janwilmake/install-this-mcp" 
            class="footer-link flex flex-row items-center gap-2 text-sm">
                <img src="https://img.shields.io/github/stars/janwilmake/install-this-mcp?style=social" alt="GitHub stars">
                <span>Installation instructions powered by install-this-mcp</span>
            </a>
        </div>

        <div>
        <a href="/${encodeURIComponent(
          serverName
        )}/guides?url=${encodeURIComponent(mcpUrl)}" 
           class="footer-link inline-flex items-center gap-2 text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
            </svg>
            <span>Want this guide into your docs or README?</span>
        </a>
        </div>
    </div>
    
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const isIframeParam = urlParams.get('iframe') === '1';
        const isSmallScreen = window.innerWidth <= 600;
        
        if (isIframeParam || isSmallScreen) {
            document.documentElement.classList.add('iframe-mode');
        }

        function copyText(text, button) {
            navigator.clipboard.writeText(text).then(() => {
                const original = button.textContent;
                button.textContent = '✓ Copied';
                setTimeout(() => button.textContent = original, 2000);
            }).catch(err => {
                console.error('Copy failed:', err);
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    const original = button.textContent;
                    button.textContent = '✓ Copied';
                    setTimeout(() => button.textContent = original, 2000);
                } catch (e) {
                    alert('Copy failed. Please copy manually.');
                }
                document.body.removeChild(textArea);
            });
        }
        
        function navigateToClient(clientName) {
            const iframeParam = isIframeParam ? '&iframe=1' : '';
            window.location.href = \`/${encodeURIComponent(
              serverName
            )}/for/\${encodeURIComponent(clientName)}?url=${encodeURIComponent(
    mcpUrl
  )}\${iframeParam}\`;
        }

        function navigateBack() {
            const iframeParam = isIframeParam ? '?iframe=1&url=' : '?url=';
            window.location.href = \`/${encodeURIComponent(
              serverName
            )}\${iframeParam}${encodeURIComponent(mcpUrl)}\`;
        }
    </script>
    <script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
</body>
</html>`;
}

function generateGuidesPage(
  mcpUrl: string,
  serverName: string,
  configs: MCPConfig[]
): string {
  const baseUrl = `https://installthismcp.com/${encodeURIComponent(
    serverName
  )}?url=${encodeURIComponent(mcpUrl)}`;
  const fullGuide = generateMCPInstallationGuide(mcpUrl, serverName);

  const permalinkMarkdown = configs
    .map((config) => {
      const clientUrl = `https://installthismcp.com/${encodeURIComponent(
        serverName
      )}/for/${encodeURIComponent(config.client)}?url=${encodeURIComponent(
        mcpUrl
      )}`;
      return `- [${config.client}](${clientUrl})`;
    })
    .join("\n");

  const buttonMarkdown = `[![Install ${serverName}](https://img.shields.io/badge/Install_MCP-${encodeURIComponent(
    serverName
  )}-1e3a8a?style=for-the-badge)](${baseUrl})`;

  const iframeCode = `<iframe src="${baseUrl}&iframe=1" width="480" height="600" frameborder="0" title="Install ${serverName}"></iframe>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Installation Guides - ${serverName}</title>
    <meta name="description" content="Installation guides and embed code for ${serverName}">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .copy-success {
            background-color: #10b981 !important;
            color: white !important;
        }
        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .collapsible-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }
        .collapsible-content.expanded {
            max-height: 800px;
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen p-4">
    <div class="max-w-3xl mx-auto py-8">
        <!-- Header -->
        <div class="text-center mb-8">
            <button onclick="window.location.href='/${encodeURIComponent(
              serverName
            )}?url=${encodeURIComponent(mcpUrl)}'"
                    class="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Back to installation
            </button>
            
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Add An Installation Guide to Your Docs</h1>
            <p class="text-lg text-gray-600 mb-4">For <strong>${serverName}</strong> maintainers and contributors</p>
            
            <div class="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-lg border border-gray-200 shadow-sm">
                <span class="text-sm text-gray-600">Powered by</span>
                <a href="https://github.com/janwilmake/install-this-mcp" 
                   target="_blank"
                   class="flex items-center gap-2 text-gray-900 hover:text-gray-700 transition-colors">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="font-semibold">install-this-mcp</span>
                </a>
                <a href="https://github.com/janwilmake/install-this-mcp" target="_blank">
                    <img src="https://img.shields.io/github/stars/janwilmake/install-this-mcp?style=social" alt="GitHub stars">
                </a>
            </div>
        </div>

        <div class="space-y-6">
            <!-- Install Button Badge -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="flex items-start gap-3 mb-4">
                    <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h2 class="text-lg font-semibold text-gray-900 mb-1">Installation Badge</h2>
                        <p class="text-sm text-gray-600">Add this badge to your README.md</p>
                    </div>
                </div>
                
                <div class="relative mb-3">
                    <pre class="bg-gray-900 text-gray-100 p-4 rounded text-sm overflow-x-auto">${buttonMarkdown}</pre>
                    <button onclick="copyCode(0, this)"
                            class="absolute top-3 right-3 px-3 py-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors">
                        Copy
                    </button>
                </div>

                <div class="flex items-center justify-center p-4 bg-gray-50 rounded">
                    <img src="https://img.shields.io/badge/Install_MCP-${encodeURIComponent(
                      serverName
                    )}-1e3a8a?style=for-the-badge" alt="Install button">
                </div>
            </div>

            <!-- Client Links -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="flex items-start gap-3 mb-4">
                    <div class="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h2 class="text-lg font-semibold text-gray-900 mb-1">Direct Client Links</h2>
                        <p class="text-sm text-gray-600">Link to specific installation instructions</p>
                    </div>
                </div>
                
                <div class="relative">
                    <pre class="bg-gray-900 text-gray-100 p-4 rounded text-sm overflow-x-auto">${permalinkMarkdown}</pre>
                    <button onclick="copyCode(1, this)"
                            class="absolute top-3 right-3 px-3 py-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors">
                        Copy
                    </button>
                </div>
            </div>

            <!-- Full Guide -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="flex items-start gap-3 mb-4">
                    <div class="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h2 class="text-lg font-semibold text-gray-900 mb-1">Complete Installation Guide</h2>
                        <p class="text-sm text-gray-600">Full markdown guide for all clients (${
                          fullGuide.split("\n").length
                        } lines)</p>
                    </div>
                </div>
                
                <div class="relative">
                    <pre class="bg-gray-900 text-gray-100 p-4 rounded text-sm max-h-96 overflow-x-auto">${fullGuide
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")}</pre>
                    <button onclick="copyCode(2, this)"
                            class="absolute top-3 right-3 px-3 py-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors">
                        Copy
                    </button>
                </div>
            </div>

            <!-- Embed Widget (Collapsible) -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="flex items-start gap-3 mb-4">
                    <div class="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <button onclick="toggleEmbed()" class="w-full text-left">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2 class="text-lg font-semibold text-gray-900 mb-1">Embed Widget on Website (BETA)</h2>
                                    <p class="text-sm text-gray-600">Interactive installation widget (click to expand)</p>
                                </div>
                                <svg id="embed-icon" class="w-5 h-5 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </div>
                        </button>
                    </div>
                </div>
                
                <div id="embed-content" class="collapsible-content">
                    <div class="relative mb-4">
                        <pre class="bg-gray-900 text-gray-100 p-4 rounded text-sm overflow-x-auto">${iframeCode
                          .replace(/&/g, "&amp;")
                          .replace(/</g, "&lt;")
                          .replace(/>/g, "&gt;")
                          .replace(/"/g, "&quot;")}</pre>
                        <button onclick="copyCode(3, this)"
                                class="absolute top-3 right-3 px-3 py-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors">
                            Copy
                        </button>
                    </div>

                    <div class="border-t border-gray-200 pt-4">
                        <p class="text-sm font-medium text-gray-700 mb-3">Preview:</p>
                        <div class="flex justify-center bg-gray-50 p-8 rounded border border-gray-200">
                            <iframe src="${baseUrl}&iframe=1" 
                                    width="480" 
                                    height="600" 
                                    frameborder="0"
                                    title="Install ${serverName}"></iframe>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const copyableContent = [
            ${JSON.stringify(buttonMarkdown)},
            ${JSON.stringify(permalinkMarkdown)},
            ${JSON.stringify(fullGuide)},
            ${JSON.stringify(iframeCode)}
        ];

        function toggleEmbed() {
            const content = document.getElementById('embed-content');
            const icon = document.getElementById('embed-icon');
            content.classList.toggle('expanded');
            icon.style.transform = content.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        function copyCode(index, button) {
            const text = copyableContent[index];
            navigator.clipboard.writeText(text).then(() => {
                const original = button.textContent;
                button.classList.add('copy-success');
                button.textContent = '✓ Copied!';
                setTimeout(() => {
                    button.classList.remove('copy-success');
                    button.textContent = original;
                }, 2000);
            }).catch(err => {
                console.error('Copy failed:', err);
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    const original = button.textContent;
                    button.classList.add('copy-success');
                    button.textContent = '✓ Copied!';
                    setTimeout(() => {
                        button.classList.remove('copy-success');
                        button.textContent = original;
                    }, 2000);
                } catch (e) {
                    alert('Copy failed. Please copy manually.');
                }
                document.body.removeChild(textArea);
            });
        }
    </script>
    <script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
</body>
</html>`;
}

function generateLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install This MCP</title>
    <meta name="description" content="Generate shareable installation guides for your MCP server">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 font-sans min-h-screen flex items-center justify-center px-4">
    <div class="max-w-md w-full">
        <div class="text-center flex flex-col justify-center items-center mb-8">
            <div class="w-16 h-16 mx-auto mb-4 bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-sm">
                <svg class="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
            </div>
            <h1 class="text-3xl font-semibold text-gray-900 mb-2">Install This MCP</h1>
            <p class="text-gray-600">Generate shareable installation guides for your MCP server</p>

            <p class="text-center pt-4">
                <a href="https://github.com/janwilmake/install-this-mcp">
                    <img src="https://img.shields.io/github/stars/janwilmake/install-this-mcp?style=social" alt="GitHub stars">
                </a>
            </p>
        </div>
        
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <form id="mcpForm" class="space-y-4">
                <div>
                    <label for="name" class="block text-sm font-medium text-gray-700 mb-2">Server Name</label>
                    <input type="text" 
                           id="name" 
                           name="name" 
                           placeholder="My Awesome MCP Server"
                           class="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                           required>
                </div>
                
                <div>
                    <label for="url" class="block text-sm font-medium text-gray-700 mb-2">Server URL</label>
                    <input type="url" 
                           id="url" 
                           name="url" 
                           placeholder="https://api.example.com/mcp"
                           class="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                           required>
                </div>
                
                <button type="submit" 
                        class="w-full bg-gray-900 text-white py-3 px-4 rounded font-medium hover:bg-gray-700 transition-colors">
                    Generate Installation Guide
                </button>
            </form>
            
            <div class="mt-6 pt-6 border-t border-gray-200">
                <p class="text-sm text-gray-600 mb-2"><strong>Example:</strong></p>
                <p class="text-xs text-gray-500"><strong>Name:</strong> Parallel Task MCP</p>
                <p class="text-xs text-gray-500"><strong>URL:</strong> https://task-mcp.parallel.ai/mcp</p>
            </div>
        </div>
    </div>
    
    <script>
        document.getElementById('mcpForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const url = document.getElementById('url').value;
            
            if (name && url) {
                window.location.href = '/' + encodeURIComponent(name) + '?url=' + encodeURIComponent(url);
            }
        });
    </script>
    <script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/favicon.svg") {
      const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
</svg>`;

      return new Response(favicon, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const mcpUrl = url.searchParams.get("url");

    if (pathParts.length > 0 && mcpUrl) {
      const metadata = await fetchMCPMetadata(mcpUrl);
      const serverName =
        metadata?.serverInfo?.title || decodeURIComponent(pathParts[0]);

      // Handle guides page: /{name}/guides
      if (pathParts.length === 2 && pathParts[1] === "guides") {
        try {
          const configs = generateMCPConfig(mcpUrl, serverName);
          const html = generateGuidesPage(mcpUrl, serverName, configs);

          return new Response(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch (error) {
          return new Response(
            "Error generating guides: " + (error as Error).message,
            {
              status: 500,
              headers: { "Content-Type": "text/plain" },
            }
          );
        }
      }

      let selectedClient: string | null = null;

      // Handle client-specific page: /{name}/for/{client}
      if (pathParts.length === 3 && pathParts[1] === "for") {
        selectedClient = decodeURIComponent(pathParts[2]);
      }

      try {
        const configs = generateMCPConfig(mcpUrl, serverName);
        const html = generateHTML(
          mcpUrl,
          serverName,
          configs,
          selectedClient,
          metadata
        );

        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (error) {
        return new Response(
          "Error generating guide: " + (error as Error).message,
          {
            status: 500,
            headers: { "Content-Type": "text/plain" },
          }
        );
      }
    }

    const landingPage = generateLandingPage();
    return new Response(landingPage, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};
