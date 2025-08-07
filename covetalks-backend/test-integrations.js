<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CoveTalks API Testing Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        header {
            background: white;
            padding: 2rem;
            border-radius: 15px;
            margin-bottom: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        h1 {
            color: #155588;
            margin-bottom: 0.5rem;
        }

        .subtitle {
            color: #666;
        }

        .test-section {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .test-section h2 {
            color: #155588;
            margin-bottom: 1.5rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e1e8ed;
        }

        .test-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1rem;
        }

        .test-card {
            border: 2px solid #e1e8ed;
            border-radius: 10px;
            padding: 1rem;
            transition: all 0.3s;
        }

        .test-card:hover {
            border-color: #155588;
            box-shadow: 0 3px 10px rgba(21, 85, 136, 0.1);
        }

        .test-card h3 {
            color: #333;
            margin-bottom: 0.5rem;
            font-size: 1rem;
        }

        .test-card p {
            color: #666;
            font-size: 0.85rem;
            margin-bottom: 1rem;
        }

        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s;
            font-size: 0.9rem;
        }

        .btn-primary {
            background: #155588;
            color: white;
        }

        .btn-primary:hover {
            background: #1e3d6f;
        }

        .btn-success {
            background: #27ae60;
            color: white;
        }

        .btn-danger {
            background: #e74c3c;
            color: white;
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .test-status {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 0.5rem;
        }

        .status-pending {
            background: #f0f0f0;
            color: #666;
        }

        .status-running {
            background: #3498db;
            color: white;
        }

        .status-success {
            background: #27ae60;
            color: white;
        }

        .status-error {
            background: #e74c3c;
            color: white;
        }

        .console {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 1rem;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            height: 400px;
            overflow-y: auto;
            margin-top: 1rem;
        }

        .console-line {
            margin-bottom: 0.5rem;
            padding: 0.25rem;
        }

        .console-success {
            color: #4ec9b0;
        }

        .console-error {
            color: #f48771;
        }

        .console-info {
            color: #9cdcfe;
        }

        .console-warn {
            color: #dcdcaa;
        }

        .credentials {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 10px;
            margin-bottom: 1rem;
        }

        .credentials h3 {
            color: #155588;
            margin-bottom: 0.5rem;
        }

        .credentials-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }

        .credential-item {
            background: white;
            padding: 0.75rem;
            border-radius: 5px;
            border: 1px solid #e1e8ed;
        }

        .credential-item label {
            display: block;
            color: #666;
            font-size: 0.75rem;
            margin-bottom: 0.25rem;
        }

        .credential-item .value {
            color: #333;
            font-weight: 500;
            font-size: 0.85rem;
            word-break: break-all;
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 1rem;
        }

        .summary-card {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 10px;
            text-align: center;
        }

        .summary-card .number {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }

        .summary-card .label {
            color: #666;
            font-size: 0.85rem;
        }

        .config-section {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 10px;
            margin-bottom: 1rem;
        }

        .config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }

        .config-item input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #e1e8ed;
            border-radius: 5px;
        }

        .loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #155588;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 0.5rem;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🧪 CoveTalks API Testing Dashboard</h1>
            <p class="subtitle">Test all backend functions directly from your browser</p>
        </header>

        <!-- Configuration -->
        <div class="test-section">
            <h2>⚙️ Configuration</h2>
            <div class="config-section">
                <div class="config-grid">
                    <div class="config-item">
                        <label>API Base URL</label>
                        <input type="text" id="apiBase" value="/.netlify/functions">
                    </div>
                    <div class="config-item">
                        <label>Environment</label>
                        <input type="text" id="environment" value="Development" readonly>
                    </div>
                </div>
            </div>
            <button class="btn btn-primary" onclick="runAllTests()">
                🚀 Run All Tests
            </button>
            <button class="btn btn-danger" onclick="clearConsole()">
                Clear Console
            </button>
        </div>

        <!-- Test Summary -->
        <div class="test-section">
            <h2>📊 Test Summary</h2>
            <div class="summary">
                <div class="summary-card">
                    <div class="number" id="totalTests">0</div>
                    <div class="label">Total Tests</div>
                </div>
                <div class="summary-card">
                    <div class="number" id="passedTests" style="color: #27ae60;">0</div>
                    <div class="label">Passed</div>
                </div>
                <div class="summary-card">
                    <div class="number" id="failedTests" style="color: #e74c3c;">0</div>
                    <div class="label">Failed</div>
                </div>
                <div class="summary-card">
                    <div class="number" id="pendingTests" style="color: #3498db;">0</div>
                    <div class="label">Pending</div>
                </div>
            </div>
        </div>

        <!-- Test Credentials -->
        <div class="test-section">
            <h2>🔑 Test Credentials</h2>
            <div class="credentials">
                <div class="credentials-grid">
                    <div class="credential-item">
                        <label>Speaker Email</label>
                        <div class="value" id="speakerEmail">Not created yet</div>
                    </div>
                    <div class="credential-item">
                        <label>Speaker Token</label>
                        <div class="value" id="speakerToken">Not created yet</div>
                    </div>
                    <div class="credential-item">
                        <label>Organization Email</label>
                        <div class="value" id="orgEmail">Not created yet</div>
                    </div>
                    <div class="credential-item">
                        <label>Organization Token</label>
                        <div class="value" id="orgToken">Not created yet</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Authentication Tests -->
        <div class="test-section">
            <h2>🔐 Authentication Tests</h2>
            <div class="test-grid">
                <div class="test-card">
                    <h3>Speaker Signup <span class="test-status status-pending" id="status-speaker-signup">Pending</span></h3>
                    <p>Create a new speaker account</p>
                    <button class="btn btn-primary" onclick="testSpeakerSignup()">Run Test</button>
                </div>
                <div class="test-card">
                    <h3>Organization Signup <span class="test-status status-pending" id="status-org-signup">Pending</span></h3>
                    <p>Create a new organization account</p>
                    <button class="btn btn-primary" onclick="testOrgSignup()">Run Test</button>
                </div>
                <div class="test-card">
                    <h3>User Login <span class="test-status status-pending" id="status-login">Pending</span></h3>
                    <p>Test login with valid credentials</p>
                    <button class="btn btn-primary" onclick="testLogin()">Run Test</button>
                </div>
                <div class="test-card">
                    <h3>Invalid Login <span class="test-status status-pending" id="status-invalid-login">Pending</span></h3>
                    <p>Test login with invalid credentials</p>
                    <button class="btn btn-primary" onclick="testInvalidLogin()">Run Test</button>
                </div>
            </div>
        </div>

        <!-- Profile Tests -->
        <div class="test-section">
            <h2>👤 Profile Tests</h2>
            <div class="test-grid">
                <div class="test-card">
                    <h3>Get Profile <span class="test-status status-pending" id="status-get-profile">Pending</span></h3>
                    <p>Retrieve user profile data</p>
                    <button class="btn btn-primary" onclick="testGetProfile()">Run Test</button>
                </div>
                <div class="test-card">
                    <h3>Update Profile <span class="test-status status-pending" id="status-update-profile">Pending</span></h3>
                    <p>Update profile information</p>
                    <button class="btn btn-primary" onclick="testUpdateProfile()">Run Test</button>
                </div>
            </div>
        </div>

        <!-- Members Tests -->
        <div class="test-section">
            <h2>👥 Members Tests</h2>
            <div class="test-grid">
                <div class="test-card">
                    <h3>List Members <span class="test-status status-pending" id="status-list-members">Pending</span></h3>
                    <p>Get list of all members</p>
                    <button class="btn btn-primary" onclick="testListMembers()">Run Test</button>
                </div>
                <div class="test-card">
                    <h3>Search Members <span class="test-status status-pending" id="status-search-members">Pending</span></h3>
                    <p>Search with filters</p>
                    <button class="btn btn-primary" onclick="testSearchMembers()">Run Test</button>
                </div>
            </div>
        </div>

        <!-- Console Output -->
        <div class="test-section">
            <h2>📝 Console Output</h2>
            <div class="console" id="console"></div>
        </div>
    </div>

    <script>
        // Test data storage
        const testData = {
            speaker: {
                email: `speaker_${Date.now()}@test.com`,
                password: 'Test123!',
                name: 'Test Speaker',
                token: null,
                userId: null
            },
            organization: {
                email: `org_${Date.now()}@test.com`,
                password: 'Test123!',
                name: 'Test Organization',
                token: null,
                userId: null
            }
        };

        // Stats
        let stats = {
            total: 0,
            passed: 0,
            failed: 0,
            pending: 0
        };

        // API Base
        function getApiBase() {
            return document.getElementById('apiBase').value;
        }

        // Console logging
        function log(message, type = 'info') {
            const console = document.getElementById('console');
            const line = document.createElement('div');
            line.className = `console-line console-${type}`;
            line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            console.appendChild(line);
            console.scrollTop = console.scrollHeight;
        }

        function clearConsole() {
            document.getElementById('console').innerHTML = '';
            log('Console cleared', 'info');
        }

        // Update test status
        function updateStatus(testId, status) {
            const element = document.getElementById(`status-${testId}`);
            if (element) {
                element.className = `test-status status-${status}`;
                element.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            }
            updateStats();
        }

        // Update statistics
        function updateStats() {
            document.getElementById('totalTests').textContent = stats.total;
            document.getElementById('passedTests').textContent = stats.passed;
            document.getElementById('failedTests').textContent = stats.failed;
            document.getElementById('pendingTests').textContent = stats.pending;
        }

        // API call helper
        async function apiCall(endpoint, options = {}) {
            const url = `${getApiBase()}/${endpoint}`;
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: options.body ? JSON.stringify(options.body) : undefined
            });
            
            const data = await response.json();
            return { status: response.status, data };
        }

        // Test functions
        async function testSpeakerSignup() {
            updateStatus('speaker-signup', 'running');
            log('Testing speaker signup...', 'info');
            
            try {
                const response = await apiCall('auth-signup', {
                    method: 'POST',
                    body: {
                        email: testData.speaker.email,
                        password: testData.speaker.password,
                        name: testData.speaker.name,
                        memberType: 'Speaker',
                        phone: '+1 555-0100'
                    }
                });
                
                if (response.status === 200 && response.data.success) {
                    testData.speaker.token = response.data.token;
                    testData.speaker.userId = response.data.user.id;
                    
                    document.getElementById('speakerEmail').textContent = testData.speaker.email;
                    document.getElementById('speakerToken').textContent = testData.speaker.token.substring(0, 20) + '...';
                    
                    updateStatus('speaker-signup', 'success');
                    stats.passed++;
                    log('✓ Speaker signup successful', 'success');
                } else {
                    throw new Error(response.data.error || 'Signup failed');
                }
            } catch (error) {
                updateStatus('speaker-signup', 'error');
                stats.failed++;
                log(`✗ Speaker signup failed: ${error.message}`, 'error');
            }
        }

        async function testOrgSignup() {
            updateStatus('org-signup', 'running');
            log('Testing organization signup...', 'info');
            
            try {
                const response = await apiCall('auth-signup', {
                    method: 'POST',
                    body: {
                        email: testData.organization.email,
                        password: testData.organization.password,
                        name: testData.organization.name,
                        memberType: 'Organization',
                        phone: '+1 555-0200',
                        organizationData: {
                            Organization_Name: 'Test Org Inc',
                            Organization_Type: 'Non-Profit'
                        }
                    }
                });
                
                if (response.status === 200 && response.data.success) {
                    testData.organization.token = response.data.token;
                    testData.organization.userId = response.data.user.id;
                    
                    document.getElementById('orgEmail').textContent = testData.organization.email;
                    document.getElementById('orgToken').textContent = testData.organization.token.substring(0, 20) + '...';
                    
                    updateStatus('org-signup', 'success');
                    stats.passed++;
                    log('✓ Organization signup successful', 'success');
                } else {
                    throw new Error(response.data.error || 'Signup failed');
                }
            } catch (error) {
                updateStatus('org-signup', 'error');
                stats.failed++;
                log(`✗ Organization signup failed: ${error.message}`, 'error');
            }
        }

        async function testLogin() {
            updateStatus('login', 'running');
            log('Testing user login...', 'info');
            
            try {
                const response = await apiCall('auth-login', {
                    method: 'POST',
                    body: {
                        email: testData.speaker.email,
                        password: testData.speaker.password
                    }
                });
                
                if (response.status === 200 && response.data.success) {
                    updateStatus('login', 'success');
                    stats.passed++;
                    log('✓ Login successful', 'success');
                } else {
                    throw new Error(response.data.error || 'Login failed');
                }
            } catch (error) {
                updateStatus('login', 'error');
                stats.failed++;
                log(`✗ Login failed: ${error.message}`, 'error');
            }
        }

        async function testInvalidLogin() {
            updateStatus('invalid-login', 'running');
            log('Testing invalid login...', 'info');
            
            try {
                const response = await apiCall('auth-login', {
                    method: 'POST',
                    body: {
                        email: testData.speaker.email,
                        password: 'WrongPassword'
                    }
                });
                
                if (response.status !== 200) {
                    updateStatus('invalid-login', 'success');
                    stats.passed++;
                    log('✓ Invalid login correctly rejected', 'success');
                } else {
                    throw new Error('Invalid login should have failed');
                }
            } catch (error) {
                if (error.message === 'Invalid login should have failed') {
                    updateStatus('invalid-login', 'error');
                    stats.failed++;
                    log(`✗ ${error.message}`, 'error');
                } else {
                    updateStatus('invalid-login', 'success');
                    stats.passed++;
                    log('✓ Invalid login correctly rejected', 'success');
                }
            }
        }

        async function testGetProfile() {
            updateStatus('get-profile', 'running');
            log('Testing get profile...', 'info');
            
            try {
                const response = await apiCall('profile-get', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${testData.speaker.token}`
                    }
                });
                
                if (response.status === 200 && response.data.success) {
                    updateStatus('get-profile', 'success');
                    stats.passed++;
                    log('✓ Profile retrieved successfully', 'success');
                } else {
                    throw new Error(response.data.error || 'Get profile failed');
                }
            } catch (error) {
                updateStatus('get-profile', 'error');
                stats.failed++;
                log(`✗ Get profile failed: ${error.message}`, 'error');
            }
        }

        async function testUpdateProfile() {
            updateStatus('update-profile', 'running');
            log('Testing update profile...', 'info');
            
            try {
                const response = await apiCall('profile-update', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${testData.speaker.token}`
                    },
                    body: {
                        bio: 'Updated test bio',
                        location: 'Test City, Test State'
                    }
                });
                
                if (response.status === 200 && response.data.success) {
                    updateStatus('update-profile', 'success');
                    stats.passed++;
                    log('✓ Profile updated successfully', 'success');
                } else {
                    throw new Error(response.data.error || 'Update profile failed');
                }
            } catch (error) {
                updateStatus('update-profile', 'error');
                stats.failed++;
                log(`✗ Update profile failed: ${error.message}`, 'error');
            }
        }

        async function testListMembers() {
            updateStatus('list-members', 'running');
            log('Testing list members...', 'info');
            
            try {
                const response = await apiCall('members-list', {
                    method: 'GET'
                });
                
                if (response.status === 200 && response.data.success) {
                    updateStatus('list-members', 'success');
                    stats.passed++;
                    log(`✓ Listed ${response.data.members.length} members`, 'success');
                } else {
                    throw new Error(response.data.error || 'List members failed');
                }
            } catch (error) {
                updateStatus('list-members', 'error');
                stats.failed++;
                log(`✗ List members failed: ${error.message}`, 'error');
            }
        }

        async function testSearchMembers() {
            updateStatus('search-members', 'running');
            log('Testing search members...', 'info');
            
            try {
                const response = await apiCall('members-list?search=test&type=Speaker', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${testData.speaker.token}`
                    }
                });
                
                if (response.status === 200 && response.data.success) {
                    updateStatus('search-members', 'success');
                    stats.passed++;
                    log(`✓ Search returned ${response.data.members.length} results`, 'success');
                } else {
                    throw new Error(response.data.error || 'Search members failed');
                }
            } catch (error) {
                updateStatus('search-members', 'error');
                stats.failed++;
                log(`✗ Search members failed: ${error.message}`, 'error');
            }
        }

        // Run all tests
        async function runAllTests() {
            log('Starting all tests...', 'info');
            stats = { total: 8, passed: 0, failed: 0, pending: 8 };
            updateStats();
            
            // Reset all statuses
            document.querySelectorAll('.test-status').forEach(el => {
                el.className = 'test-status status-pending';
                el.textContent = 'Pending';
            });
            
            // Run tests in sequence
            await testSpeakerSignup();
            await new Promise(r => setTimeout(r, 500));
            
            await testOrgSignup();
            await new Promise(r => setTimeout(r, 500));
            
            await testLogin();
            await new Promise(r => setTimeout(r, 500));
            
            await testInvalidLogin();
            await new Promise(r => setTimeout(r, 500));
            
            await testGetProfile();
            await new Promise(r => setTimeout(r, 500));
            
            await testUpdateProfile();
            await new Promise(r => setTimeout(r, 500));
            
            await testListMembers();
            await new Promise(r => setTimeout(r, 500));
            
            await testSearchMembers();
            
            stats.pending = 0;
            updateStats();
            
            log(`\nTests complete: ${stats.passed} passed, ${stats.failed} failed`, 
                stats.failed > 0 ? 'warn' : 'success');
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            log('Testing dashboard ready', 'info');
            log('Click "Run All Tests" to begin', 'info');
        });
    </script>
</body>
</html>