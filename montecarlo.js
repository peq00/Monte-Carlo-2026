const SIMULATIONS = 20000;
let results = null;

class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

function parseVelocity(text) {
    if (!text || text.trim() === '') return [];
    return text.split(',').map(v => {
        const num = parseInt(v.trim());
        return isNaN(num) || num < 0 ? 0 : num;
    }).filter(v => v >= 0);
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-button');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

function runSimulation() {
    const resultsDiv = document.getElementById('simulationResults');
    resultsDiv.innerHTML = '<div class="loading">⏳ Wykonuję 20 000 symulacji...</div>';
    
    setTimeout(() => {
        try {
            const backlogSize = parseInt(document.getElementById('backlogSize').value);
            const startDateStr = document.getElementById('startDate').value;
            const forecastDateStr = document.getElementById('forecastDate').value;
            const sprintLength = parseInt(document.getElementById('sprintLength').value);
            const velocity = parseVelocity(document.getElementById('velocity').value);
            const growthPercent = parseInt(document.getElementById('backlogGrowth').value);
            
            if (!backlogSize || backlogSize <= 0) throw new Error('Backlog musi być > 0');
            if (!velocity || velocity.length === 0) throw new Error('Podaj historię przepustowości');
            if (!startDateStr || !forecastDateStr) throw new Error('Podaj wszystkie daty');
            if (velocity.every(v => v === 0)) throw new Error('Historia nie może zawierać samych zer');
            
            const startDate = new Date(startDateStr + 'T00:00:00');
            const forecastDate = new Date(forecastDateStr + 'T00:00:00');
            
            if (forecastDate < startDate) throw new Error('Data prognozy musi być po dacie startu');
            
            const newItems = Math.round(backlogSize * growthPercent / 100);
            const totalBacklog = backlogSize + newItems;
            
            const completionDates = [];
            const itemsCounts = [];
            const sprintProbs = new Array(50).fill(0);
            const sprintTotals = new Array(50).fill(0);
            
            for (let sim = 0; sim < SIMULATIONS; sim++) {
                const rng = new SeededRandom(sim + 42);
                let completed = 0;
                let sprintNum = 0;
                let completionDate = null;
                
                // Symulacja do ukończenia całego zakresu
                while (completed < totalBacklog && sprintNum < 50) {
                    const velocityIdx = Math.floor(rng.next() * velocity.length);
                    const velocity_val = velocity[velocityIdx];
                    completed += velocity_val;
                    
                    const sprintEnd = addDays(startDate, (sprintNum + 1) * sprintLength - 1);
                    
                    if (sprintNum < 50) {
                        sprintTotals[sprintNum]++;
                        if (completed >= totalBacklog) {
                            sprintProbs[sprintNum]++;
                            completionDate = new Date(sprintEnd);
                        }
                    }
                    
                    sprintNum++;
                }
                
                if (completionDate) {
                    completionDates.push(completionDate);
                }
                
                // Liczenie elementów ukończonych do deadline'u
                let completedByForecast = 0;
                let sprintEnd = addDays(startDate, sprintLength - 1);
                sprintNum = 0;
                
                const rng2 = new SeededRandom(sim + 42);
                while (sprintEnd <= forecastDate && sprintNum < 50) {
                    const velocityIdx = Math.floor(rng2.next() * velocity.length);
                    completedByForecast += velocity[velocityIdx];
                    
                    sprintEnd = addDays(startDate, (sprintNum + 2) * sprintLength - 1);
                    sprintNum++;
                }
                
                // Ostrożny scenariusz: nowe elementy mogą wypierać pierwotny zakres
                const reallyCompleted = Math.max(0, Math.min(completedByForecast - newItems, backlogSize));
                itemsCounts.push(reallyCompleted);
            }
            
            results = {
                completionDates,
                itemsCounts,
                backlogSize,
                newItems,
                totalBacklog,
                startDate,
                forecastDate,
                sprintLength,
                velocity,
                sprintProbs,
                sprintTotals
            };
            
            displayResults(results);
        } catch (error) {
            resultsDiv.innerHTML = `<div class="error">❌ Błąd: ${error.message}</div>`;
        }
    }, 50);
}

function displayResults(r) {
    const resultsDiv = document.getElementById('simulationResults');
    
    if (r.completionDates.length === 0) {
        resultsDiv.innerHTML = '<div class="error">❌ Brak danych do wyświetlenia</div>';
        return;
    }
    
    const sortedDates = r.completionDates.slice().sort((a, b) => a - b);
    const idx85 = Math.floor(sortedDates.length * 0.15);
    const idx95 = Math.floor(sortedDates.length * 0.05);
    const date85 = sortedDates[Math.min(idx85, sortedDates.length - 1)];
    const date95 = sortedDates[Math.min(idx95, sortedDates.length - 1)];
    
    const sprints85 = calculateSprintsDiff(r.startDate, date85, r.sprintLength);
    const sprints95 = calculateSprintsDiff(r.startDate, date95, r.sprintLength);
    
    const sortedItems = r.itemsCounts.slice().sort((a, b) => a - b);
    const items85 = sortedItems[Math.floor(sortedItems.length * 0.15)];
    const items95 = sortedItems[Math.floor(sortedItems.length * 0.05)];
    
    const formatDate = (d) => d.toLocaleDateString('pl-PL');
    
    let html = '<div class="results">';
    html += '<h3 style="margin-top: 0;">📅 Kiedy ukończymy cały zakres?</h3>';
    html += '<div class="result-item">';
    html += `<div class="result-label">85% szans ukończenia:</div>`;
    html += `<div class="result-value">${formatDate(date85)}</div>`;
    html += `<div class="result-detail">${sprints85} Sprintów</div>`;
    html += '</div>';
    html += '<div class="result-item">';
    html += `<div class="result-label">95% szans ukończenia:</div>`;
    html += `<div class="result-value">${formatDate(date95)}</div>`;
    html += `<div class="result-detail">${sprints95} Sprintów</div>`;
    html += '</div>';
    
    html += '<h3>📦 Ile ukończymy do ' + formatDate(r.forecastDate) + '?</h3>';
    html += '<div class="result-item">';
    html += `<div class="result-label">85% szans na co najmniej:</div>`;
    html += `<div class="result-value">${items85} z ${r.backlogSize}</div>`;
    html += `<div class="result-detail">pierwotnych elementów</div>`;
    html += '</div>';
    html += '<div class="result-item">';
    html += `<div class="result-label">95% szans na co najmniej:</div>`;
    html += `<div class="result-value">${items95} z ${r.backlogSize}</div>`;
    html += `<div class="result-detail">pierwotnych elementów</div>`;
    html += '</div>';
    
    if (r.newItems > 0) {
        const totalItems85 = items85 + r.newItems;
        const totalItems95 = items95 + r.newItems;
        html += '<div class="result-item">';
        html += `<div class="result-label">85% szans na co najmniej (razem z nowymi):</div>`;
        html += `<div class="result-value">${totalItems85} z ${r.totalBacklog}</div>`;
        html += '</div>';
        html += '<div class="result-item">';
        html += `<div class="result-label">95% szans na co najmniej (razem z nowymi):</div>`;
        html += `<div class="result-value">${totalItems95} z ${r.totalBacklog}</div>`;
        html += '</div>';
    }
    
    html += '<div class="chart-container"><canvas id="chart"></canvas></div>';
    
    html += '<div class="explanation">';
    html += '📌 <strong>Informacja:</strong> Prognoza opiera się na ' + r.velocity.length + ' historycznych Sprintach ';
    html += 'i zakłada podobne warunki pracy w przyszłości.';
    html += '</div>';
    html += '</div>';
    
    resultsDiv.innerHTML = html;
    
    drawChart(r);
}

function calculateSprintsDiff(startDate, endDate, sprintLength) {
    const diffMs = endDate - startDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return Math.ceil(diffDays / sprintLength);
}

function drawChart(r) {
    const canvas = document.getElementById('chart');
    if (!canvas) return;
    
    const sprintProbs = [];
    const sprintLabels = [];
    
    for (let i = 0; i < 20 && r.sprintTotals[i] > 0; i++) {
        const prob = (r.sprintProbs[i] / r.sprintTotals[i]) * 100;
        sprintProbs.push(prob);
        sprintLabels.push(`Sprint ${i + 1}`);
    }
    
    new Chart(canvas, {
        type: 'line',
        data: {
            labels: sprintLabels,
            datasets: [{
                label: 'Prawdopodobieństwo ukończenia',
                data: sprintProbs,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#667eea'
            },
            {
                label: 'Próg 85%',
                data: Array(sprintLabels.length).fill(85),
                borderColor: '#ffa726',
                borderDash: [5, 5],
                borderWidth: 2,
                fill: false,
                pointRadius: 0
            },
            {
                label: 'Próg 95%',
                data: Array(sprintLabels.length).fill(95),
                borderColor: '#ef5350',
                borderDash: [5, 5],
                borderWidth: 2,
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

function updateGrowthInfo() {
    const backlogSize = parseInt(document.getElementById('backlogSize').value) || 62;
    const growth = parseInt(document.getElementById('backlogGrowth').value) || 0;
    const newItems = Math.round(backlogSize * growth / 100);
    const total = backlogSize + newItems;
    
    document.getElementById('growthPercent').textContent = growth;
    const info = document.getElementById('growthInfo');
    if (growth > 0) {
        info.innerHTML = `<strong>+${growth}%</strong> → ${newItems} nowych elementów → ${total} łącznie<br>
        <small>Nowa praca może wypierać pierwotny zakres w ramach dostępnej przepustowości.</small>`;
    } else {
        info.innerHTML = 'Brak wzrostu backlogu';
    }
}

function resetDefaults() {
    document.getElementById('backlogSize').value = '62';
    document.getElementById('startDate').value = '2027-01-04';
    document.getElementById('forecastDate').value = '2027-03-31';
    document.getElementById('sprintLength').value = '14';
    document.getElementById('velocity').value = '5, 4, 4, 5, 6, 4, 2, 3, 2, 5, 6';
    document.getElementById('backlogGrowth').value = '0';
    updateGrowthInfo();
    document.getElementById('simulationResults').innerHTML = '';
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('backlogGrowth').addEventListener('input', updateGrowthInfo);
    updateGrowthInfo();
});
