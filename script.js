// Portfolio Application
document.addEventListener('DOMContentLoaded', function () {
    // State
    let projects = [];
    let filteredProjects = [];
    let currentCategory = 'all';
    let currentType = 'all';
    let currentProject = null;
    let currentMediaIndex = 0;
    let categoryCounts = {};
    let imageCache = new Map(); // NEW: Cache for images

    // DOM Elements
    const projectsContainer = document.getElementById('projectsContainer');
    const projectModal = document.getElementById('projectModal');
    const typeFilterNav = document.getElementById('typeFilterNav');
    const mediaContainer = document.getElementById('mediaContainer');

    // Initialize
    init();

    function init() {
        showLoading();
        loadProjects();
        setupEventListeners();
    }

    // Load projects from JSON file
    async function loadProjects() {
        try {
            // Add cache busting but with 5-minute cache for frequent visits
            const timestamp = Math.floor(Date.now() / 300000); // 5 minutes
            const response = await fetch(`projects.json?t=${timestamp}`);

            if (!response.ok) {
                throw new Error(`Failed to load: ${response.status}`);
            }

            const data = await response.json();

            // Validate data
            if (!data.projects || !Array.isArray(data.projects)) {
                throw new Error('Invalid JSON structure');
            }

            // Process projects with defaults
            projects = data.projects.map((project, index) => ({
                id: project.id || index + 1,
                title: project.title || 'Untitled Project',
                category: project.category || 'uncategorized',
                type: project.type || 'Other',
                date: project.date || 'Unknown Date',
                sortDate: parseYearMonth(project.date),
                tools: project.tools || [],
                skills: project.skills || [],
                description: project.description || 'No description available.',
                links: project.links || [],
                media: project.media || []
            }));

            // Sort projects by date (newest first)
            projects.sort((a, b) => {
                if (b.sortDate.year !== a.sortDate.year) {
                    return b.sortDate.year - a.sortDate.year;
                }
                return b.sortDate.month - a.sortDate.month;
            });

            // Pre-cache thumbnails for faster loading
            preCacheThumbnails();

            // Calculate category counts
            calculateCategoryCounts();

            // Update filter buttons with counts
            updateFilterButtonsWithCounts();

            filteredProjects = [...projects];
            renderProjects();

        } catch (error) {
            console.error('Error loading projects:', error);
            showError(`Failed to load projects: ${error.message}`);
        }
    }

    // NEW: Pre-cache thumbnails for faster loading
    function preCacheThumbnails() {
        projects.forEach(project => {
            if (project.media && project.media.length > 0) {
                project.media.forEach(media => {
                    if (media.thumbnail && !media.thumbnail.includes('drive.google.com/file/d/')) {
                        // Preload images (not Google Drive iframes)
                        if (media.thumbnail.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
                            const img = new Image();
                            img.src = media.thumbnail;
                            imageCache.set(media.thumbnail, img);
                        }
                    }
                });
            }
        });
    }

    // Calculate category counts
    function calculateCategoryCounts() {
        categoryCounts = {
            'all': projects.length
        };

        projects.forEach(project => {
            const category = project.category;
            if (categoryCounts[category]) {
                categoryCounts[category]++;
            } else {
                categoryCounts[category] = 1;
            }
        });
    }

    // Update filter buttons with counts
    function updateFilterButtonsWithCounts() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const category = btn.dataset.filter;
            const count = categoryCounts[category] || 0;

            // Update button text to include count
            const originalText = btn.textContent.replace(/\(\d+\)$/, '').trim();
            btn.innerHTML = `${originalText} <span class="filter-count">(${count})</span>`;
        });
    }

    // Render projects to grid with lazy loading
    function renderProjects() {
        if (filteredProjects.length === 0) {
            showEmptyState();
            return;
        }

        projectsContainer.innerHTML = '';
        filteredProjects.forEach((project, index) => {
            projectsContainer.appendChild(createProjectElement(project, index));
        });

        // Initialize lazy loading for images
        initLazyLoading();
    }

    // Create project card element with lazy loading
    function createProjectElement(project, index) {
        if (project.category === 'diary') {
            return createVisualDiaryCard(project, index);
        }
        const card = document.createElement('div');
        card.className = 'project-card';
        card.style.animationDelay = `${index * 0.1}s`;
        card.dataset.projectId = project.id;

        // Get thumbnail data
        const hasMedia = project.media && project.media.length > 0;
        const firstMedia = hasMedia ? project.media[0] : null;
        const isVideo = firstMedia && firstMedia.type === 'video';
        const mediaCount = project.media ? project.media.length : 0;

        // Create thumbnail with lazy loading
        card.innerHTML = `
            <div class="project-card-thumbnail">
                <div class="thumbnail-container loading" id="thumb-${project.id}-${index}">
                    <div class="thumbnail-media">
                        ${hasMedia && firstMedia && firstMedia.thumbnail ?
                createThumbnailContent(firstMedia.thumbnail, project.id, index, isVideo) :
                `<div class="thumbnail-fallback">
                                <i class="fas fa-image"></i>
                                <span>${hasMedia ? 'Preview not available' : 'No preview'}</span>
                            </div>`
            }
                    </div>
                </div>
                ${isVideo ? '<div class="video-indicator"><i class="fas fa-play"></i> VIDEO</div>' : ''}
                ${mediaCount > 1 ? `<div class="media-count"><i class="fas fa-images"></i> ${mediaCount}</div>` : ''}
                ${isVideo ? `
                    <div class="play-button-overlay">
                        <div class="play-button">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>` : ''}
            </div>
            <div class="project-card-content">
                <span class="project-category">${getCategoryLabel(project.category)}</span>
                <h3 class="project-title">${project.title}</h3>
                <span class="project-type">${project.type}</span>
                <p class="project-date">${project.date}</p>
            </div>
        `;

        // Add click event
        card.addEventListener('click', () => openProjectModal(project));
        return card;
    }

    // Create thumbnail content with lazy loading
    function createThumbnailContent(thumbnailUrl, projectId, index, isVideo) {
        const thumbId = `thumb-${projectId}-${index}`;

        // If it's a video thumbnail (Google Drive), use placeholder first
        if (isVideo && thumbnailUrl.includes('drive.google.com')) {
            // Use a data attribute for lazy loading
            return `<div class="thumbnail-placeholder" 
                      data-src="${thumbnailUrl}"
                      data-thumb-id="${thumbId}">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                    </div>`;
        }

        // If it's an image URL
        if (thumbnailUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
            // Check cache first
            if (imageCache.has(thumbnailUrl)) {
                const img = imageCache.get(thumbnailUrl);
                return `<img 
                    src="${thumbnailUrl}" 
                    alt="Project thumbnail"
                    loading="lazy"
                    onload="handleThumbnailLoad(event, '${thumbId}')"
                    onerror="handleThumbnailError(event, '${thumbId}')"
                />`;
            } else {
                // Lazy load with placeholder
                return `<img 
                    src="" 
                    data-src="${thumbnailUrl}"
                    alt="Project thumbnail"
                    loading="lazy"
                    class="lazy-image"
                    onload="handleThumbnailLoad(event, '${thumbId}')"
                    onerror="handleThumbnailError(event, '${thumbId}')"
                />`;
            }
        }

        // Default: lazy load iframe
        return `<div class="iframe-placeholder" 
                      data-src="${thumbnailUrl}"
                      data-thumb-id="${thumbId}">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                    </div>`;
    }

    // NEW: Initialize lazy loading
    function initLazyLoading() {
        // Lazy load images
        const lazyImages = document.querySelectorAll('img.lazy-image');
        const lazyIframes = document.querySelectorAll('.thumbnail-placeholder, .iframe-placeholder');

        // Load images that are in viewport
        lazyImages.forEach(img => {
            if (isInViewport(img)) {
                loadImage(img);
            }
        });

        // Load iframes that are in viewport
        lazyIframes.forEach(placeholder => {
            if (isInViewport(placeholder)) {
                loadIframe(placeholder);
            }
        });

        // Add scroll listener for lazy loading
        if (lazyImages.length > 0 || lazyIframes.length > 0) {
            window.addEventListener('scroll', lazyLoadHandler);
        }
    }

    // NEW: Check if element is in viewport
    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    // NEW: Lazy load handler
    function lazyLoadHandler() {
        const lazyImages = document.querySelectorAll('img.lazy-image[data-src]');
        const lazyIframes = document.querySelectorAll('.thumbnail-placeholder[data-src], .iframe-placeholder[data-src]');

        lazyImages.forEach(img => {
            if (isInViewport(img)) {
                loadImage(img);
            }
        });

        lazyIframes.forEach(placeholder => {
            if (isInViewport(placeholder)) {
                loadIframe(placeholder);
            }
        });
    }

    // NEW: Load image
    function loadImage(img) {
        const src = img.dataset.src;
        if (!src) return;

        img.src = src;
        img.removeAttribute('data-src');
        img.classList.remove('lazy-image');
    }

    // NEW: Load iframe (for Google Drive)
    function loadIframe(placeholder) {
        const src = placeholder.dataset.src;
        const thumbId = placeholder.dataset.thumbId;
        if (!src) return;

        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.frameborder = '0';
        iframe.loading = 'lazy';
        iframe.title = 'Project preview';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowfullscreen = true;
        iframe.onload = () => {
            const container = document.getElementById(thumbId);
            if (container) container.classList.remove('loading');
        };
        iframe.onerror = () => {
            const container = document.getElementById(thumbId);
            if (container) {
                container.classList.remove('loading');
                const fallback = container.querySelector('.thumbnail-fallback');
                if (fallback) fallback.style.display = 'flex';
            }
        };

        placeholder.parentNode.replaceChild(iframe, placeholder);
    }

    // Helper function to get category label
    function getCategoryLabel(category) {
        const labels = {
            'graphic': 'Graphic Design',
            'video': 'Video Production',
            'animation': 'Animation',
            '3d': '3D Modeling',
            'audio': 'Audio Production'
        };
        return labels[category] || category;
    }

    // Handle thumbnail image load
    window.handleThumbnailLoad = function (event, thumbId) {
        const container = document.getElementById(thumbId);
        if (container) {
            container.classList.remove('loading');
            const img = event.target;
            const aspectRatio = img.naturalWidth / img.naturalHeight;

            if (aspectRatio > 1.77) {
                img.style.maxWidth = '100%';
                img.style.maxHeight = 'auto';
            } else if (aspectRatio < 1.3) {
                img.style.maxWidth = 'auto';
                img.style.maxHeight = '100%';
            } else {
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
            }
        }
    };

    // Handle thumbnail error
    window.handleThumbnailError = function (event, thumbId) {
        const container = document.getElementById(thumbId);
        if (container) {
            container.classList.remove('loading');
            const fallback = container.querySelector('.thumbnail-fallback');
            if (fallback) fallback.style.display = 'flex';
        }
    };

    // Filter projects
    function filterProjects() {
        let filtered = [...projects];

        if (currentCategory !== 'all') {
            filtered = filtered.filter(p => p.category === currentCategory);
        }

        if (currentType !== 'all') {
            filtered = filtered.filter(p => p.type === currentType);
        }

        filteredProjects = filtered;
        renderProjects();
        typeFilterNav.style.display = currentCategory === 'all' ? 'none' : 'block';
    }

    // Open project modal - FIXED for disappearing content
    function openProjectModal(project) {
        // Don't stop videos immediately, just pause them
        pauseAllVideos();

        currentProject = project;
        currentMediaIndex = 0;

        updateModal();

        // Show modal
        projectModal.style.display = 'block';
        setTimeout(() => {
            projectModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }, 10);
    }

    // NEW: Pause videos instead of removing them
    function pauseAllVideos() {
        const iframes = mediaContainer.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                // Pause video by setting src to current src (reloads but keeps iframe)
                const currentSrc = iframe.src;
                if (currentSrc && currentSrc !== 'about:blank') {
                    iframe.src = currentSrc;
                }
            } catch (error) {
                console.log('Error pausing iframe:', error);
            }
        });
    }

    // Update modal content - FIXED for visibility change issue
    function updateModal() {
        if (!currentProject) return;

        const project = currentProject;
        const media = project.media || [];
        const currentMedia = media[currentMediaIndex];

        // Clear container but keep iframes for visibility change
        const iframesToKeep = mediaContainer.querySelectorAll('iframe');
        mediaContainer.innerHTML = '';

        // Update media
        if (currentMedia && currentMedia.embed) {
            mediaContainer.innerHTML = createMediaElement(currentMedia, project.title);
        } else {
            mediaContainer.innerHTML = '<div class="no-media"><i class="fas fa-photo-video"></i><p>No media available</p></div>';
        }

        // Update navigation
        document.querySelector('.media-prev').disabled = currentMediaIndex === 0;
        document.querySelector('.media-next').disabled = currentMediaIndex === media.length - 1;
        document.getElementById('currentMedia').textContent = media.length > 0 ? currentMediaIndex + 1 : 0;
        document.getElementById('totalMedia').textContent = media.length;

        // Update project info
        document.getElementById('modalTitle').textContent = project.title;
        document.getElementById('modalCategory').textContent = getCategoryLabel(project.category);
        document.getElementById('modalType').textContent = project.type;
        document.getElementById('modalDate').textContent = project.date;
        document.getElementById('modalMediaCount').textContent = `${media.length} item${media.length !== 1 ? 's' : ''}`;
        document.getElementById('modalDescription').textContent = project.description;

        // Update tools
        const toolsContainer = document.getElementById('modalTools');
        toolsContainer.innerHTML = project.tools && project.tools.length > 0 ?
            project.tools.map(tool => `<span class="tool-tag">${tool}</span>`).join('') :
            '<span class="tool-tag">No tools listed</span>';

        // Update skills
        const skillsContainer = document.getElementById('modalSkills');
        skillsContainer.innerHTML = project.skills && project.skills.length > 0 ?
            project.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('') :
            '<span class="skill-tag">No skills specified</span>';

        // Update links
        const linksContainer = document.getElementById('modalLinks');
        if (project.links && project.links.length > 0) {
            linksContainer.innerHTML = createLinksHTML(project.links);
            linksContainer.style.display = 'block';
        } else {
            linksContainer.innerHTML = '';
            linksContainer.style.display = 'none';
        }
    }

    // Create media element for modal - FIXED for visibility issue
    function createMediaElement(media, title) {
        const embed = media.embed || '';
        const srcMatch = embed.match(/src=['"]([^'"]+)['"]/);
        let src = srcMatch ? srcMatch[1] : '';
        const isVideo = media.type === 'video';
        const aspectRatio = isVideo ? '16-9' : '4-3';

        // For video platforms, ensure autoplay is disabled
        if (src.includes('youtube.com') || src.includes('youtu.be')) {
            if (!src.includes('autoplay=')) {
                src += (src.includes('?') ? '&' : '?') + 'autoplay=0';
            }
        } else if (src.includes('drive.google.com')) {
            if (!src.includes('autoplay=')) {
                src += (src.includes('?') ? '&' : '?') + 'autoplay=0';
            }
            // Add prevent caching parameter
            if (!src.includes('cachePrevent')) {
                src += (src.includes('?') ? '&' : '?') + 'cachePrevent=' + Date.now();
            }
        }

        return `
            <div class="aspect-ratio-wrapper aspect-ratio-wrapper-${aspectRatio}">
                <iframe 
                    src="${src}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    title="${title} - Media ${currentMediaIndex + 1}"
                    onload="handleModalIframeLoad()"
                ></iframe>
            </div>
        `;
    }

    // NEW: Handle modal iframe load
    window.handleModalIframeLoad = function () {
        console.log('Modal iframe loaded successfully');
    };

    // Navigation between media
    function nextMedia() {
        if (currentProject && currentMediaIndex < currentProject.media.length - 1) {
            currentMediaIndex++;
            updateModal();
        }
    }

    function prevMedia() {
        if (currentMediaIndex > 0) {
            currentMediaIndex--;
            updateModal();
        }
    }

    // Close modal
    function closeModal() {
        // Just pause videos, don't remove them
        pauseAllVideos();

        projectModal.classList.remove('active');
        setTimeout(() => {
            projectModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);

        currentProject = null;
        currentMediaIndex = 0;
    }

    // Show loading state
    function showLoading() {
        projectsContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading portfolio projects...</span>
            </div>
        `;
    }

    // Show empty state
    function showEmptyState() {
        let message = '';
        if (currentCategory !== 'all') {
            const count = categoryCounts[currentCategory] || 0;
            const categoryName = getCategoryLabel(currentCategory);
            message = `No ${categoryName.toLowerCase()} projects found. ${count > 0 ? `There are ${count} ${categoryName.toLowerCase()} project${count !== 1 ? 's' : ''} in total.` : ''}`;
        } else if (currentType !== 'all') {
            message = 'No projects match your current type filter.';
        } else {
            message = 'No projects available.';
        }

        projectsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>No Projects Found</h3>
                <p>${message}</p>
                ${currentCategory !== 'all' || currentType !== 'all' ?
                '<button class="clear-filters-btn">Clear All Filters</button>' : ''}
            </div>
        `;

        // Add event listener for clear filters button
        const clearBtn = projectsContainer.querySelector('.clear-filters-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearFilters);
        }
    }

    // Show error state
    function showError(message) {
        projectsContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Unable to Load Portfolio</h3>
                <p>${message}</p>
                <button class="reload-btn">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;

        // Add event listener for reload button
        projectsContainer.querySelector('.reload-btn').addEventListener('click', () => {
            window.location.reload();
        });
    }

    // Clear all filters
    window.clearFilters = function () {
        currentCategory = 'all';
        currentType = 'all';

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === 'all');
        });

        document.querySelectorAll('.type-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'all');
        });

        typeFilterNav.style.display = 'none';
        filterProjects();
    };

    // Setup event listeners - ADDED visibility change fix
    function setupEventListeners() {
        // Category filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentCategory = this.dataset.filter;
                filterProjects();
            });
        });

        // Type filters
        document.querySelectorAll('.type-filter-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentType = this.dataset.type;
                filterProjects();
            });
        });

        // Modal controls
        document.querySelector('.modal-close').addEventListener('click', closeModal);
        document.querySelector('.modal-overlay').addEventListener('click', closeModal);

        // Media navigation
        document.querySelector('.media-next').addEventListener('click', nextMedia);
        document.querySelector('.media-prev').addEventListener('click', prevMedia);

        // Keyboard shortcuts
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && projectModal.classList.contains('active')) {
                closeModal();
            }
            if (projectModal.classList.contains('active')) {
                if (e.key === 'ArrowRight') nextMedia();
                if (e.key === 'ArrowLeft') prevMedia();
            }
        });

        // FIXED: Handle visibility change - reload iframe when coming back
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && projectModal.classList.contains('active')) {
                // User came back to tab with modal open
                const iframe = mediaContainer.querySelector('iframe');
                if (iframe && iframe.src) {
                    // Refresh the iframe to restore content
                    const currentSrc = iframe.src;
                    iframe.src = currentSrc;
                }
            }
        });

        // Also handle page focus
        window.addEventListener('focus', function () {
            if (projectModal.classList.contains('active')) {
                const iframe = mediaContainer.querySelector('iframe');
                if (iframe && iframe.src) {
                    // Small delay to ensure page is fully focused
                    setTimeout(() => {
                        const currentSrc = iframe.src;
                        iframe.src = currentSrc;
                    }, 100);
                }
            }
        });
    }

    function parseYearMonth(dateString) {
        // Default values for unknown dates
        let year = 2000;
        let month = 1;

        if (!dateString || dateString === 'Unknown Date') {
            return { year, month, sortKey: 0 };
        }

        // Try to extract year and month from common formats
        const dateStr = dateString.toLowerCase();

        // Format 1: "Month Year" (e.g., "August 2024", "Dec 2023")
        const monthYearMatch = dateStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/i);

        if (monthYearMatch) {
            const monthNames = {
                'january': 1, 'jan': 1,
                'february': 2, 'feb': 2,
                'march': 3, 'mar': 3,
                'april': 4, 'apr': 4,
                'may': 5,
                'june': 6, 'jun': 6,
                'july': 7, 'jul': 7,
                'august': 8, 'aug': 8,
                'september': 9, 'sep': 9,
                'october': 10, 'oct': 10,
                'november': 11, 'nov': 11,
                'december': 12, 'dec': 12
            };

            month = monthNames[monthYearMatch[1].toLowerCase()] || 1;
            year = parseInt(monthYearMatch[2], 10);
            return { year, month, sortKey: year * 100 + month };
        }

        // Format 2: "Year-Month" (e.g., "2024-08", "2023-12")
        const dashMatch = dateStr.match(/(\d{4})[-/](\d{1,2})/);
        if (dashMatch) {
            year = parseInt(dashMatch[1], 10);
            month = parseInt(dashMatch[2], 10);
            return { year, month, sortKey: year * 100 + month };
        }

        // Format 3: Just year (e.g., "2024")
        const yearMatch = dateStr.match(/(\d{4})/);
        if (yearMatch) {
            year = parseInt(yearMatch[1], 10);
            return { year, month, sortKey: year * 100 };
        }

        return { year, month, sortKey: 0 };
    }

    // Create HTML for links
    function createLinksHTML(links) {
        return `
        <div class="links-section">
            <h3><i class="fas fa-link"></i> Related Links</h3>
            <div class="links-list">
                ${links.map(link => `
                    <a href="${link.url}" class="project-link" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-external-link-alt"></i>
                        <span>${link.text || link.url}</span>
                    </a>
                `).join('')}
            </div>
        </div>
    `;
    }
    // Create special Visual Diary card
    function createVisualDiaryCard(project, index) {
        const card = document.createElement('div');
        card.className = 'project-card visual-diary-card';
        card.style.animationDelay = `${index * 0.1}s`;
        card.dataset.projectId = project.id;
        card.dataset.category = 'diary';

        card.innerHTML = `
        <div class="visual-diary-content">
            <div class="diary-icon">
                <i class="fab fa-instagram"></i>
            </div>
            <h3 class="diary-title">Visual Diary</h3>
            <p class="diary-message">Follow my creative journey on Instagram!!</p>
            <div class="diary-buttons">
                <a href="https://www.instagram.com/_tziyy_lens_/" class="instagram-btn" target="_blank" rel="noopener noreferrer">
                    <i class="fab fa-instagram"></i>
                    <span>Follow on Instagram</span>
                </a>
                <button class="diary-tap-hint">
                    <i class="fas fa-hand-point-up"></i>
                    <span>Tap anywhere to open Instagram</span>
                </button>
            </div>
        </div>
    `;

        // Use both click and touch events for mobile compatibility
        card.addEventListener('click', handleDiaryClick, false);
        card.addEventListener('touchend', handleDiaryClick, { passive: true });

        function handleDiaryClick(e) {
            // Don't redirect if clicking the Instagram button
            if (e.target.closest('.instagram-btn')) {
                return;
            }

            // Don't redirect if clicking the hint button
            if (e.target.closest('.diary-tap-hint')) {
                return;
            }

            // Prevent default and open Instagram
            e.preventDefault();
            e.stopPropagation();

            // Open Instagram in new tab
            window.open('https://www.instagram.com/_tziyy_lens_/', '_blank');
        }

        return card;
    }
});