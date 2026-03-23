document.addEventListener('DOMContentLoaded', function() {
    initializeMenuToggle();
    initializeNavigation();
    initializeThemeToggle();
    initializeScrollAnimation();
});

// 初始化菜單切換功能 (主要用於舊版或平板模式)
function initializeMenuToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    // 如果存在相關元素
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
        
        // 點擊內容區域關閉菜單 (移動端)
        document.querySelector('.content').addEventListener('click', () => {
             if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
                 sidebar.classList.remove('active');
             }
        });
    }
}

// 初始化導航切換
function initializeNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.page-section');

    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();

            // 移除所有活躍狀態
            menuItems.forEach(i => i.classList.remove('active'));
            sections.forEach(s => {
                s.classList.remove('active');
                s.style.opacity = '0'; // 重置動畫狀態
            });

            // 添加當前項的活躍狀態
            this.classList.add('active');
            
            // 顯示對應的頁面區塊並觸發淡入
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                // 稍微延遲以觸發 CSS transition/animation
                setTimeout(() => {
                    targetSection.style.opacity = '1';
                }, 50);
            }
        });
    });
}

// 初始化主題切換
function initializeThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    
    // 檢查本地存儲
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
        if (themeToggle) themeToggle.checked = savedTheme === 'dark';
    } else {
        // 預設深色
        html.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.checked = true;
    }

    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                html.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            } else {
                html.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // 簡約模式 (這裡可以做更複雜的邏輯，目前簡單處理)
    const minimalistToggle = document.getElementById('minimalistMode');
    if (minimalistToggle) {
        minimalistToggle.addEventListener('change', function() {
            document.body.classList.toggle('minimalist', this.checked);
        });
    }
}

// 初始化滾動動畫 (Intersection Observer)
function initializeScrollAnimation() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // 動畫只播放一次
            }
        });
    }, observerOptions);

    // 觀察所有卡片和列表項
    const animatedElements = document.querySelectorAll('.card, .game-item, .news-item, .stat, .hero-card');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });
    
    // 添加 visible 類別的樣式
    const style = document.createElement('style');
    style.innerHTML = `
        .visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);
}
