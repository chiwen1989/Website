        // Common UI Elements
        const toast = document.getElementById('toast');
        const questSteps = document.querySelectorAll('.step-item');

        // UI Logic: Materials Toggle
        const toggleBtn = document.getElementById('toggle-materials');
        const materialsContent = document.getElementById('materials-content');
        
        function updateMaterialsUI(isVisible) {
            materialsContent.style.display = isVisible ? 'block' : 'none';
            toggleBtn.textContent = isVisible ? '折疊' : '展開';
            localStorage.setItem('ro_modern_materials_visible', isVisible);
        }

        const savedMaterialsVisible = localStorage.getItem('ro_modern_materials_visible');
        updateMaterialsUI(savedMaterialsVisible === null || savedMaterialsVisible === 'true');

        toggleBtn.addEventListener('click', () => {
            const isVisible = materialsContent.style.display !== 'none';
            updateMaterialsUI(!isVisible);
        });

        // Progress Logic
        const resetBtn = document.getElementById('reset-progress');
        
        function saveProgress() {
            const progress = {};
            questSteps.forEach(step => {
                const id = step.getAttribute('data-id');
                const isChecked = step.querySelector('.custom-cb').checked;
                progress[id] = isChecked;
            });
            localStorage.setItem('ro_modern_ep20_progress', JSON.stringify(progress));
        }

        function loadProgress() {
            const savedProgress = localStorage.getItem('ro_modern_ep20_progress');
            if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                questSteps.forEach(step => {
                    const id = step.getAttribute('data-id');
                    if (progress[id]) {
                        step.querySelector('.custom-cb').checked = true;
                        step.classList.add('completed');
                    }
                });
            }
        }

        loadProgress();

        questSteps.forEach(step => {
            const checkbox = step.querySelector('.custom-cb');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    step.classList.add('completed');
                } else {
                    step.classList.remove('completed');
                }
                saveProgress();
            });
        });

        resetBtn.addEventListener('click', () => {
            if (confirm('確定要清除所有已完成的任務進度嗎？這將會重置所有勾選狀態。')) {
                localStorage.removeItem('ro_modern_ep20_progress');
                questSteps.forEach(step => {
                    step.querySelector('.custom-cb').checked = false;
                    step.classList.remove('completed');
                });
                
                // Show temporary reset toast
                const originalText = toast.textContent;
                toast.textContent = '進度已全部重置';
                toast.classList.add('show');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => {
                        toast.textContent = originalText;
                    }, 300);
                }, 2000);
            }
        });

        // Back to Top Logic
        const backToTopBtn = document.getElementById('back-to-top');
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Navi Logic
        document.querySelectorAll('.btn-navi').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = btn.getAttribute('data-navi');
                navigator.clipboard.writeText(text).then(() => {
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 2000);
                });
            });
        });
