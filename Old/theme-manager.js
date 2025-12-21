// Theme Manager - Handles automatic dark/light theme detection and switching
class ThemeManager {
    constructor() {
        this.init();
    }

    init() {
        // Detect system theme preference
        this.detectSystemTheme();
        
        // Listen for system theme changes
        this.watchSystemTheme();
        
        // Check for stored theme preference
        this.loadStoredTheme();
        
        // Apply initial theme
        this.applyTheme();
    }

    detectSystemTheme() {
        // Check if browser supports prefers-color-scheme
        if (window.matchMedia) {
            this.systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
            this.systemTheme = 'light'; // fallback
        }
    }

    watchSystemTheme() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            // Modern browsers
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', (e) => {
                    this.systemTheme = e.matches ? 'dark' : 'light';
                    // Only apply if no manual theme is set
                    if (!this.manualTheme) {
                        this.applyTheme();
                    }
                });
            }
            // Older browsers
            else if (mediaQuery.addListener) {
                mediaQuery.addListener((e) => {
                    this.systemTheme = e.matches ? 'dark' : 'light';
                    if (!this.manualTheme) {
                        this.applyTheme();
                    }
                });
            }
        }
    }

    loadStoredTheme() {
        // Check localStorage for manual theme preference
        const stored = localStorage.getItem('theme');
        if (stored && ['light', 'dark', 'auto'].includes(stored)) {
            this.manualTheme = stored === 'auto' ? null : stored;
        }
    }

    getCurrentTheme() {
        // Return manual theme if set, otherwise system theme
        return this.manualTheme || this.systemTheme;
    }

    applyTheme() {
        const theme = this.getCurrentTheme();
        const body = document.body;
        
        // Remove existing theme classes and data attributes
        body.classList.remove('theme-light', 'theme-dark');
        body.removeAttribute('data-theme');
        
        // Add current theme as data attribute
        body.setAttribute('data-theme', theme);
        
        // Update theme color meta tag for mobile browsers
        this.updateThemeColor(theme);
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: theme } 
        }));
    }

    updateThemeColor(theme) {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        
        // Set theme color based on current theme
        const colors = {
            light: '#ffffff',
            dark: '#1a1a1a'
        };
        
        metaThemeColor.content = colors[theme];
    }

    setTheme(theme) {
        // theme can be 'light', 'dark', or 'auto'
        if (theme === 'auto') {
            this.manualTheme = null;
            localStorage.removeItem('theme');
        } else if (['light', 'dark'].includes(theme)) {
            this.manualTheme = theme;
            localStorage.setItem('theme', theme);
        }
        
        this.applyTheme();
    }

    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    // Add theme toggle button to the interface
    addThemeToggleButton() {
        // Check if button already exists
        if (document.querySelector('.theme-toggle-btn')) {
            console.log('Theme toggle button already exists');
            return document.querySelector('.theme-toggle-btn');
        }
        
        const toggleButton = document.createElement('button');
        toggleButton.className = 'theme-toggle-btn';
        toggleButton.title = 'Toggle theme';
        toggleButton.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
        `;
        
        toggleButton.addEventListener('click', () => {
            this.toggleTheme();
            this.updateToggleIcon(toggleButton);
        });
        
        // Initial icon state
        this.updateToggleIcon(toggleButton);
        
        // Add to user-info section in header
        const userInfo = document.querySelector('.user-info') || 
                        document.querySelector('.header-right') ||
                        document.querySelector('.header-content') ||
                        document.querySelector('.dashboard-controls') ||
                        document.body;
        
        userInfo.appendChild(toggleButton);
        
        return toggleButton;
    }

    updateToggleIcon(button) {
        const theme = this.getCurrentTheme();
        const icon = theme === 'dark' ? 
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>` :
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>`;
        
        button.innerHTML = icon;
    }
}

// Initialize theme manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Prevent multiple instances
    if (window.themeManager) {
        console.log('Theme manager already exists');
        return;
    }
    
    window.themeManager = new ThemeManager();
    
    // Add theme toggle button automatically
    window.themeManager.addThemeToggleButton();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
