// Question Import Functions for Word and Excel

// Make importedQuestions globally accessible
window.importedQuestions = window.importedQuestions || [];
let importedQuestions = window.importedQuestions;

// Make function globally accessible
window.showQuestionInput = function(type) {
    // Hide all input sections
    document.querySelectorAll('.question-input-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.question-input-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(type + '-input');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Add active class to clicked tab
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Find the tab button for this type
        const tabs = document.querySelectorAll('.question-input-tabs .tab-btn');
        tabs.forEach((tab, index) => {
            if (index === 0 && type === 'manual') tab.classList.add('active');
            else if (index === 1 && type === 'excel') tab.classList.add('active');
            else if (index === 2 && type === 'word') tab.classList.add('active');
        });
    }
};

window.handleExcelUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('excel-preview');
    preview.innerHTML = '<div class="spinner"></div><p>Reading file...</p>';
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get first sheet
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            if (jsonData.length === 0) {
                preview.innerHTML = '<div class="alert alert-error">No data found in file. Please check the format.</div>';
                return;
            }
            
            // Parse questions
            importedQuestions = [];
            window.importedQuestions = importedQuestions;
            jsonData.forEach((row, index) => {
                const question = row.Question || row.question || row['Question Text'];
                const option1 = row.Option1 || row.option1 || row['Option 1'] || row.A || row.a;
                const option2 = row.Option2 || row.option2 || row['Option 2'] || row.B || row.b;
                const option3 = row.Option3 || row.option3 || row['Option 3'] || row.C || row.c;
                const option4 = row.Option4 || row.option4 || row['Option 4'] || row.D || row.d;
                const correct = row.CorrectAnswer || row.correctanswer || row['Correct Answer'] || row.Answer || row.answer;
                
                if (question && option1 && option2 && option3 && option4) {
                    // Parse correct answer (can be 1-4, a-d, A-D)
                    let correctAnswer = 0;
                    if (typeof correct === 'number') {
                        correctAnswer = correct - 1; // Convert 1-4 to 0-3
                    } else if (typeof correct === 'string') {
                        const answerStr = correct.toString().toLowerCase().trim();
                        if (answerStr === 'a' || answerStr === '1') correctAnswer = 0;
                        else if (answerStr === 'b' || answerStr === '2') correctAnswer = 1;
                        else if (answerStr === 'c' || answerStr === '3') correctAnswer = 2;
                        else if (answerStr === 'd' || answerStr === '4') correctAnswer = 3;
                    }
                    
                    importedQuestions.push({
                        question: question.toString(),
                        options: [
                            option1.toString(),
                            option2.toString(),
                            option3.toString(),
                            option4.toString()
                        ],
                        correctAnswer: correctAnswer
                    });
                    window.importedQuestions = importedQuestions; // Update global reference
                }
            });
            
            if (importedQuestions.length === 0) {
                preview.innerHTML = '<div class="alert alert-error">Could not parse questions. Please check column names: Question, Option1, Option2, Option3, Option4, CorrectAnswer</div>';
                return;
            }
            
            // Show preview and import button
            preview.innerHTML = `
                <div class="alert alert-success">
                    Successfully imported ${importedQuestions.length} question(s)!
                </div>
                <div style="max-height: 300px; overflow-y: auto; margin-top: 15px;">
                    <table style="width: 100%; font-size: 0.9rem;">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Question</th>
                                <th>Options</th>
                                <th>Correct</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${importedQuestions.map((q, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${q.question.substring(0, 50)}${q.question.length > 50 ? '...' : ''}</td>
                                    <td>${q.options.length} options</td>
                                    <td>${String.fromCharCode(65 + q.correctAnswer)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <button type="button" class="btn btn-success" onclick="window.importExcelQuestions()" style="margin-top: 15px;">
                    Import ${importedQuestions.length} Question(s)
                </button>
            `;
            
        } catch (error) {
            // Error reading Excel file - will be shown via alert
            preview.innerHTML = '<div class="alert alert-error">Error reading file: ' + error.message + '</div>';
        }
    };
    
    reader.readAsArrayBuffer(file);
}

window.handleWordUpload = function(event) {
    console.log('=== WORD UPLOAD STARTED ===');
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    const preview = document.getElementById('word-preview');
    if (!preview) {
        console.error('Preview element not found!');
        return;
    }
    
    preview.innerHTML = '<div class="spinner"></div><p>Reading file...</p>';
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        console.log('File read successfully');
        
        // For Word files, we'll read as text (simple approach)
        // Note: .docx files are ZIP archives, so this works better with .doc or text extraction
        // For production, you'd want to use a library like mammoth.js
        
        // File has been read successfully
        const text = e.target.result;
        console.log('File read successfully, text length:', text.length);
        console.log('First 500 chars:', text.substring(0, 500));
        
        if (!text || text.length === 0) {
            preview.innerHTML = `
                <div class="alert alert-error">
                    File appears to be empty or could not be read as text.<br>
                    Please save your Word document as <strong>.txt</strong> format and try again.
                </div>
            `;
            return;
        }
        
        if (typeof window.parseWordQuestions === 'function') {
            window.parseWordQuestions(text, preview);
        } else {
            console.error('parseWordQuestions function not found!');
            preview.innerHTML = '<div class="alert alert-error">Error: Parsing function not available. Please refresh the page.</div>';
        }
    };
    
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        preview.innerHTML = '<div class="alert alert-error">Error reading file. Please try again.</div>';
    };
    
    // Check file extension
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.docx')) {
        // Try to read .docx file using mammoth.js
        console.log('Reading .docx file using mammoth.js...');
        
        // Check if mammoth is available
        if (typeof mammoth === 'undefined') {
            preview.innerHTML = `
                <div class="alert alert-error">
                    <strong>Error:</strong> Mammoth.js library not loaded. Please refresh the page and try again.<br><br>
                    <strong>Alternative:</strong> Save your Word document as <strong>.txt</strong> format:<br>
                    File → Save As → Choose "Plain Text (.txt)" → Save
                </div>
            `;
            return;
        }
        
        // Read file as array buffer for mammoth
        const arrayBufferReader = new FileReader();
        arrayBufferReader.onload = function(e) {
            const arrayBuffer = e.target.result;
            
            // Use mammoth to convert .docx to text
            mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                .then(function(result) {
                    const text = result.value; // The raw text
                    const messages = result.messages; // Any warnings or errors
                    
                    console.log('DOCX extracted text length:', text.length);
                    console.log('First 500 chars:', text.substring(0, 500));
                    
                    if (messages && messages.length > 0) {
                        console.warn('Mammoth warnings:', messages);
                    }
                    
                    if (!text || text.trim().length === 0) {
                        preview.innerHTML = `
                            <div class="alert alert-error">
                                File appears to be empty or could not be read.<br>
                                Please check your file format or save as <strong>.txt</strong> format.
                            </div>
                        `;
                        return;
                    }
                    
                    // Parse the extracted text
                    if (typeof window.parseWordQuestions === 'function') {
                        window.parseWordQuestions(text, preview);
                    } else {
                        console.error('parseWordQuestions function not found!');
                        preview.innerHTML = '<div class="alert alert-error">Error: Parsing function not available. Please refresh the page.</div>';
                    }
                })
                .catch(function(error) {
                    console.error('Error extracting text from .docx:', error);
                    preview.innerHTML = `
                        <div class="alert alert-error">
                            <strong>Error reading .docx file:</strong> ${error.message}<br><br>
                            <strong>Please try one of the following:</strong><br>
                            1. Save your Word document as <strong>.txt</strong> format:<br>
                               &nbsp;&nbsp;&nbsp;File → Save As → Choose "Plain Text (.txt)" → Save<br>
                            2. Copy-paste questions from Word into the manual entry section<br>
                            3. Use Excel/CSV format instead
                        </div>
                    `;
                });
        };
        
        arrayBufferReader.onerror = function(error) {
            console.error('Error reading file as array buffer:', error);
            preview.innerHTML = '<div class="alert alert-error">Error reading file. Please try again.</div>';
        };
        
        arrayBufferReader.readAsArrayBuffer(file);
        return; // Exit early, mammoth will handle the rest
    } else if (fileName.endsWith('.doc')) {
        // Try to read .doc as text (may not work perfectly)
        console.log('Reading .doc file as text (may have formatting issues)...');
        reader.readAsText(file);
    } else if (fileName.endsWith('.txt')) {
        // Perfect! .txt files work best
        console.log('Reading .txt file as text...');
        reader.readAsText(file);
    } else {
        // Unknown format, try to read as text anyway
        console.log('Unknown file format, attempting to read as text...');
        reader.readAsText(file);
    }
}

window.parseWordQuestions = function(text, preview) {
    console.log('=== PARSING WORD QUESTIONS ===');
    console.log('Text received, length:', text.length);
    
    importedQuestions = [];
    window.importedQuestions = importedQuestions;
    
    // Simple parsing: Look for numbered questions and options
    // Handle both formats: "1. Question" and " 1. Question" (with leading spaces)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log('Total lines after filtering:', lines.length);
    console.log('First 10 lines:', lines.slice(0, 10));
    
    let currentQuestion = null;
    let currentOptions = [];
    let currentAnswer = null;
    let questionCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if it's a question (starts with number followed by . or ) and space)
        // Also handle spaces before number: " 17. Question" or "17. Question"
        if (/^\s*\d+[\.\)]\s/.test(line)) {
            // Save previous question if exists
            // Handle multiple choice (4 options), True/False (2 options), or essay (0 options)
            if (currentQuestion) {
                if (currentOptions.length === 4 && currentAnswer !== null) {
                    // Multiple choice question with 4 options
                    importedQuestions.push({
                        question: currentQuestion,
                        options: currentOptions,
                        correctAnswer: currentAnswer,
                        type: 'multiple-choice'
                    });
                    window.importedQuestions = importedQuestions;
                    questionCount++;
                    console.log(`Saved multiple choice question ${questionCount}:`, currentQuestion);
                } else if (currentOptions.length === 2 && currentAnswer !== null) {
                    // True/False question (2 options)
                    importedQuestions.push({
                        question: currentQuestion,
                        options: currentOptions,
                        correctAnswer: currentAnswer,
                        type: 'multiple-choice' // Still multiple choice, just 2 options
                    });
                    window.importedQuestions = importedQuestions;
                    questionCount++;
                    console.log(`Saved True/False question ${questionCount}:`, currentQuestion);
                } else if (currentOptions.length === 0) {
                    // Essay question (no options) - save even without answer
                    importedQuestions.push({
                        question: currentQuestion,
                        options: [],
                        correctAnswer: null,
                        type: 'essay'
                    });
                    window.importedQuestions = importedQuestions;
                    questionCount++;
                    console.log(`Saved essay question ${questionCount}:`, currentQuestion);
                }
            }
            
            // Start new question
            currentQuestion = line.replace(/^\s*\d+[\.\)]\s*/, '').trim();
            currentOptions = [];
            currentAnswer = null;
            console.log('Found question:', currentQuestion);
        }
        // Check if it's an option (uppercase A-D or lowercase a-d, with . or ) and space)
        // Format: "A. Option" or "A) Option" or "a. Option"
        else if (/^[A-Da-d][\.\)]\s/.test(line)) {
            const optionText = line.replace(/^[A-Da-d][\.\)]\s*/, '').trim();
            const optionLetter = line.charAt(0).toUpperCase();
            const optionIndex = optionLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
            currentOptions[optionIndex] = optionText;
            console.log(`Found option ${optionLetter}:`, optionText);
        }
        // Check if it's the answer line (supports uppercase A-D, lowercase a-d, or numbers 1-4)
        else if (/answer\s*:?\s*[A-Da-d1-4]/i.test(line)) {
            const answerMatch = line.match(/answer\s*:?\s*([A-Da-d1-4])/i);
            if (answerMatch) {
                const answer = answerMatch[1].toUpperCase();
                if (answer >= 'A' && answer <= 'D') {
                    currentAnswer = answer.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                } else {
                    currentAnswer = parseInt(answer) - 1; // 1=0, 2=1, 3=2, 4=3
                }
                console.log('Found answer:', String.fromCharCode(65 + currentAnswer));
            }
        }
        // Also check for answer on same line as question or options (flexible format)
        else if (currentQuestion && /answer/i.test(line)) {
            const answerMatch = line.match(/answer\s*:?\s*([A-Da-d1-4])/i);
            if (answerMatch) {
                const answer = answerMatch[1].toUpperCase();
                if (answer >= 'A' && answer <= 'D') {
                    currentAnswer = answer.charCodeAt(0) - 65;
                } else {
                    currentAnswer = parseInt(answer) - 1;
                }
                console.log('Found answer (flexible):', String.fromCharCode(65 + currentAnswer));
            }
        }
    }
    
    // Save last question
    if (currentQuestion) {
        if (currentOptions.length === 4 && currentAnswer !== null) {
            // Multiple choice question with 4 options
            importedQuestions.push({
                question: currentQuestion,
                options: currentOptions,
                correctAnswer: currentAnswer,
                type: 'multiple-choice'
            });
            window.importedQuestions = importedQuestions;
            questionCount++;
            console.log(`Saved final multiple choice question ${questionCount}:`, currentQuestion);
        } else if (currentOptions.length === 2 && currentAnswer !== null) {
            // True/False question (2 options)
            importedQuestions.push({
                question: currentQuestion,
                options: currentOptions,
                correctAnswer: currentAnswer,
                type: 'multiple-choice' // Still multiple choice, just 2 options
            });
            window.importedQuestions = importedQuestions;
            questionCount++;
            console.log(`Saved final True/False question ${questionCount}:`, currentQuestion);
        } else if (currentOptions.length === 0) {
            // Essay question (no options) - save even without answer
            importedQuestions.push({
                question: currentQuestion,
                options: [],
                correctAnswer: null,
                type: 'essay'
            });
            window.importedQuestions = importedQuestions;
            questionCount++;
            console.log(`Saved final essay question ${questionCount}:`, currentQuestion);
        }
    }
    
    console.log('Total questions parsed:', importedQuestions.length);
    console.log('window.importedQuestions:', window.importedQuestions);
    console.log('===========================');
    
    if (importedQuestions.length === 0) {
        console.error('No questions parsed! Current question state:', {
            currentQuestion,
            currentOptions: currentOptions.length,
            currentAnswer
        });
        preview.innerHTML = `
            <div class="alert alert-error">
                Could not parse questions from Word document.<br>
                Please ensure format is:<br>
                1. Question text?<br>
                a) Option 1<br>
                b) Option 2<br>
                c) Option 3<br>
                d) Option 4<br>
                Answer: a<br><br>
                <strong>Debug Info:</strong><br>
                Lines processed: ${lines.length}<br>
                Current question: ${currentQuestion || 'None'}<br>
                Options found: ${currentOptions.length}/4<br>
                Answer found: ${currentAnswer !== null ? String.fromCharCode(65 + currentAnswer) : 'None'}<br>
                Check browser console (F12) for more details.
            </div>
        `;
        return;
    }
    
    // Show preview
    preview.innerHTML = `
        <div class="alert alert-success">
            Successfully parsed ${importedQuestions.length} question(s)!
        </div>
        <div style="max-height: 300px; overflow-y: auto; margin-top: 15px;">
            <table style="width: 100%; font-size: 0.9rem;">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Question</th>
                        <th>Options</th>
                        <th>Correct</th>
                    </tr>
                </thead>
                <tbody>
                    ${importedQuestions.map((q, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${q.question.substring(0, 50)}${q.question.length > 50 ? '...' : ''}</td>
                            <td>${q.options.length} options</td>
                            <td>${String.fromCharCode(65 + q.correctAnswer)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <button type="button" class="btn btn-success" onclick="window.importWordQuestions()" style="margin-top: 15px;">
            Import ${importedQuestions.length} Question(s)
        </button>
    `;
}

window.importExcelQuestions = function() {
    if (importedQuestions.length === 0) return;
    
    // Get current question count (from lecturer-dashboard.js)
    const currentCount = typeof questionCount !== 'undefined' ? questionCount : 0;
    let newQuestionCount = currentCount;
    
    // Add imported questions
    importedQuestions.forEach(q => {
        newQuestionCount++;
        addImportedQuestion(q, newQuestionCount);
    });
    
    // Update questionCount if it exists globally
    if (typeof questionCount !== 'undefined') {
        questionCount = newQuestionCount;
    }
    
    // Switch to manual tab to show imported questions
    const manualTab = document.querySelector('.question-input-tabs .tab-btn');
    if (manualTab) {
        manualTab.click();
    }
    showQuestionInput('manual');
    
    // Clear file input
    document.getElementById('excelFile').value = '';
    document.getElementById('excel-preview').innerHTML = '';
    const count = importedQuestions.length;
    importedQuestions = [];
    window.importedQuestions = importedQuestions; // Update global reference
    
    if (typeof showAlert === 'function') {
        showAlert('Successfully imported ' + count + ' question(s)!', 'success');
    } else {
        alert('Successfully imported ' + count + ' question(s)!');
    }
}

window.importWordQuestions = function() {
    if (importedQuestions.length === 0) return;
    
    // Get current question count (from lecturer-dashboard.js)
    const currentCount = typeof questionCount !== 'undefined' ? questionCount : 0;
    let newQuestionCount = currentCount;
    
    // Add imported questions
    importedQuestions.forEach(q => {
        newQuestionCount++;
        addImportedQuestion(q, newQuestionCount);
    });
    
    // Update questionCount if it exists globally
    if (typeof questionCount !== 'undefined') {
        questionCount = newQuestionCount;
    }
    
    // Switch to manual tab to show imported questions
    const manualTab = document.querySelector('.question-input-tabs .tab-btn');
    if (manualTab) {
        manualTab.click();
    }
    showQuestionInput('manual');
    
    // Clear file input
    document.getElementById('wordFile').value = '';
    document.getElementById('word-preview').innerHTML = '';
    const count = importedQuestions.length;
    importedQuestions = [];
    window.importedQuestions = importedQuestions; // Update global reference
    
    if (typeof showAlert === 'function') {
        showAlert('Successfully imported ' + count + ' question(s)!', 'success');
    } else {
        alert('Successfully imported ' + count + ' question(s)!');
    }
}

window.addImportedQuestion = function(q, qCount) {
    const container = document.getElementById('questions-list');
    if (!container) return;
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-card';
    questionDiv.id = `question-${qCount}`;
    
    // Escape HTML and quotes properly
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // Check if it's an essay question (no options)
    if (q.type === 'essay' || !q.options || q.options.length === 0) {
        questionDiv.innerHTML = `
            <h4>Question ${qCount} (Essay)</h4>
            <div class="form-group">
                <label>Question Text</label>
                <textarea class="question-text" placeholder="Enter essay question" rows="3" required>${escapeHtml(q.question)}</textarea>
            </div>
            <div class="form-group">
                <label>Maximum Points</label>
                <input type="number" class="question-points" placeholder="100" value="100" min="1" required>
            </div>
            <div class="form-group">
                <label>Expected Answer Length (words)</label>
                <input type="number" class="question-word-limit" placeholder="500" value="500" min="1">
                <small style="color: var(--text-light);">Optional: Guide for students</small>
            </div>
            <input type="hidden" class="question-type" value="essay">
            <button type="button" class="btn btn-danger" onclick="removeQuestion(${qCount})">Remove Question</button>
        `;
    } else if (q.options.length === 2) {
        // True/False question - convert to 4 options format (True, False, N/A, N/A)
        questionDiv.innerHTML = `
            <h4>Question ${qCount} (True/False)</h4>
            <div class="form-group">
                <label>Question Text</label>
                <input type="text" class="question-text" value="${escapeHtml(q.question)}" required>
            </div>
            <div class="form-group">
                <label>Option 1 (True)</label>
                <input type="text" class="option-1" value="${escapeHtml(q.options[0] || 'True')}" required>
            </div>
            <div class="form-group">
                <label>Option 2 (False)</label>
                <input type="text" class="option-2" value="${escapeHtml(q.options[1] || 'False')}" required>
            </div>
            <div class="form-group">
                <label>Option 3</label>
                <input type="text" class="option-3" value="N/A" required>
            </div>
            <div class="form-group">
                <label>Option 4</label>
                <input type="text" class="option-4" value="N/A" required>
            </div>
            <div class="form-group">
                <label>Correct Answer</label>
                <select class="correct-answer" required>
                    <option value="0" ${q.correctAnswer === 0 ? 'selected' : ''}>Option 1 (True)</option>
                    <option value="1" ${q.correctAnswer === 1 ? 'selected' : ''}>Option 2 (False)</option>
                    <option value="2" ${q.correctAnswer === 2 ? 'selected' : ''}>Option 3</option>
                    <option value="3" ${q.correctAnswer === 3 ? 'selected' : ''}>Option 4</option>
                </select>
            </div>
            <input type="hidden" class="question-type" value="multiple-choice">
            <button type="button" class="btn btn-danger" onclick="removeQuestion(${qCount})">Remove Question</button>
        `;
    } else {
        // Multiple choice question (4 options)
        questionDiv.innerHTML = `
            <h4>Question ${qCount} (Multiple Choice)</h4>
            <div class="form-group">
                <label>Question Text</label>
                <input type="text" class="question-text" value="${escapeHtml(q.question)}" required>
            </div>
            <div class="form-group">
                <label>Option 1</label>
                <input type="text" class="option-1" value="${escapeHtml(q.options[0] || '')}" required>
            </div>
            <div class="form-group">
                <label>Option 2</label>
                <input type="text" class="option-2" value="${escapeHtml(q.options[1] || '')}" required>
            </div>
            <div class="form-group">
                <label>Option 3</label>
                <input type="text" class="option-3" value="${escapeHtml(q.options[2] || '')}" required>
            </div>
            <div class="form-group">
                <label>Option 4</label>
                <input type="text" class="option-4" value="${escapeHtml(q.options[3] || '')}" required>
            </div>
            <div class="form-group">
                <label>Correct Answer</label>
                <select class="correct-answer" required>
                    <option value="0" ${q.correctAnswer === 0 ? 'selected' : ''}>Option 1</option>
                    <option value="1" ${q.correctAnswer === 1 ? 'selected' : ''}>Option 2</option>
                    <option value="2" ${q.correctAnswer === 2 ? 'selected' : ''}>Option 3</option>
                    <option value="3" ${q.correctAnswer === 3 ? 'selected' : ''}>Option 4</option>
                </select>
            </div>
            <input type="hidden" class="question-type" value="multiple-choice">
            <button type="button" class="btn btn-danger" onclick="removeQuestion(${qCount})">Remove Question</button>
        `;
    }
    container.appendChild(questionDiv);
    
    // Update question numbers if updateQuestionNumbers function exists
    if (typeof updateQuestionNumbers === 'function') {
        updateQuestionNumbers();
    }
}

function downloadQuestionTemplate(format) {
    const csvContent = `Question,Option1,Option2,Option3,Option4,CorrectAnswer
"What is the capital of Ghana?",Accra,Kumasi,Tamale,Cape Coast,1
"What is 2 + 2?",3,4,5,6,2
"Which is a programming language?",HTML,CSS,JavaScript,JSON,3`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}
