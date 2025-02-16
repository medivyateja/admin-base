// navigation.js
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements with more specific selectors
    const mobileMenuButton = document.querySelector('button[type="button"].text-gray-400.lg\\:hidden');
    const sidebar = document.querySelector('.relative.z-50.lg\\:hidden[role="dialog"]');
    const backdrop = sidebar ? sidebar.querySelector('.fixed.inset-0.bg-gray-900\\/80') : null;
    const sidebarPanel = sidebar ? sidebar.querySelector('.relative.mr-16.flex.w-full.max-w-xs') : null;
    const closeButton = sidebar ? sidebar.querySelector('button.-m-2\\.5.p-2\\.5') : null;

    // Initially hide the mobile menu
    if (sidebar) {
        sidebar.style.display = 'none';
    }

    // State management
    let isOpen = false;

    // Apply initial states
    function setInitialStates() {
        if (backdrop) {
            backdrop.style.opacity = '0';
        }
        if (sidebarPanel) {
            sidebarPanel.style.transform = 'translateX(-100%)';
        }
        if (closeButton) {
            closeButton.style.opacity = '0';
        }
    }

    // Function to open mobile menu
    function openMobileMenu() {
        if (!sidebar || isOpen) return;

        // Show the sidebar
        sidebar.style.display = 'block';
        
        // Trigger reflow
        sidebar.offsetHeight;

        // Add transitions
        if (backdrop) {
            backdrop.style.transition = 'opacity 300ms ease-linear';
            backdrop.style.opacity = '1';
        }

        if (sidebarPanel) {
            sidebarPanel.style.transition = 'transform 300ms ease-in-out';
            sidebarPanel.style.transform = 'translateX(0)';
        }

        if (closeButton) {
            closeButton.style.transition = 'opacity 300ms ease-in-out';
            closeButton.style.opacity = '1';
        }

        // Update state
        isOpen = true;
        document.body.style.overflow = 'hidden';
    }

    // Function to close mobile menu
    function closeMobileMenu() {
        if (!sidebar || !isOpen) return;

        // Start transitions
        if (backdrop) {
            backdrop.style.opacity = '0';
        }

        if (sidebarPanel) {
            sidebarPanel.style.transform = 'translateX(-100%)';
        }

        if (closeButton) {
            closeButton.style.opacity = '0';
        }

        // Wait for transitions to complete before hiding
        setTimeout(() => {
            sidebar.style.display = 'none';
            setInitialStates();
        }, 300);

        // Update state
        isOpen = false;
        document.body.style.overflow = '';
    }

    // Set up event listeners
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', openMobileMenu);
    }

    if (closeButton) {
        closeButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMobileMenu();
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            e.preventDefault();
            closeMobileMenu();
        });
    }

    // Handle escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && isOpen) {
            closeMobileMenu();
        }
    });

    // Handle resize events
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth >= 1024 && isOpen) {
                closeMobileMenu();
            }
        }, 250);
    });

    // Handle navigation items
    const navItems = document.querySelectorAll('a.group.flex.gap-x-3.rounded-md');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Only handle navigation if it's a menu item
            if (this.closest('nav')) {
                // Remove current class from all items
                navItems.forEach(navItem => {
                    navItem.classList.remove('bg-gray-800', 'text-white');
                    if (!navItem.classList.contains('hover:bg-gray-800')) {
                        navItem.classList.add('text-gray-400', 'hover:text-white', 'hover:bg-gray-800');
                    }
                });

                // Add current class to clicked item
                this.classList.add('bg-gray-800', 'text-white');
                this.classList.remove('text-gray-400', 'hover:text-white', 'hover:bg-gray-800');

                // Close mobile menu after navigation on mobile
                if (window.innerWidth < 1024) {
                    closeMobileMenu();
                }
            }
        });
    });

    // Set initial states
    setInitialStates();
});