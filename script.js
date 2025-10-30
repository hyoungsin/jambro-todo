// Firebase SDK 설정
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { getDatabase, ref, push, set, update, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// Firebase 설정 정보
const firebaseConfig = {
  apiKey: "AIzaSyD8WSpHvuwhmj57ueMKUtY2FDHkY1JVG6A",
  authDomain: "jambro-todo-backend.firebaseapp.com",
  projectId: "jambro-todo-backend",
  storageBucket: "jambro-todo-backend.firebasestorage.app",
  messagingSenderId: "1097378002565",
  appId: "1:1097378002565:web:888976f6183c2a4f8d9bec",
  measurementId: "G-3C8BM7RLN7",
  databaseURL: "https://jambro-todo-backend-default-rtdb.firebaseio.com"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// 할일 목록 저장소 (localStorage 사용)
let todos = [];
let editingId = null;

// DOM 요소 가져오기
const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const completedCount = document.getElementById('completedCount');
const remainingCount = document.getElementById('remainingCount');

// 페이지 로드 시 저장된 할일 불러오기
document.addEventListener('DOMContentLoaded', () => {
    loadTodos();
    renderTodos();
    updateStats();
});

// localStorage에서 할일 불러오기
function loadTodos() {
    const storedTodos = localStorage.getItem('todos');
    if (storedTodos) {
        todos = JSON.parse(storedTodos);
    }
}

// localStorage에 할일 저장하기
function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// 할일 추가
function addTodo() {
    const text = todoInput.value.trim();
    
    if (text === '') {
        alert('할일을 입력해주세요!');
        return;
    }

    const newTodo = {
        text: text,
        completed: false,
        createdAt: serverTimestamp()
    };

    // Firebase Realtime Database에 저장
    const todosRef = ref(db, 'todos');
    const newRef = push(todosRef);
    set(newRef, newTodo)
        .then(() => {
            // 화면 즉시 반영을 위해 로컬 상태도 업데이트
            const clientTodo = {
                id: newRef.key,
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
            };
            todos.push(clientTodo);
            saveTodos();

            todoInput.value = '';
            renderTodos();
            updateStats();
            todoInput.focus();
        })
        .catch(() => {
            // 실패 시 localStorage로 백업 저장
            const fallback = {
                id: Date.now(),
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
            };
            todos.push(fallback);
            saveTodos();
            todoInput.value = '';
            renderTodos();
            updateStats();
            todoInput.focus();
        });
}

// 할일 삭제
function deleteTodo(id) {
    if (confirm('정말 삭제하시겠습니까?')) {
        // Firebase에서 삭제 시도 (id가 Firebase key일 때)
        if (typeof id === 'string') {
            remove(ref(db, `todos/${id}`)).catch(() => {});
        }
        todos = todos.filter(todo => todo.id !== id);
        saveTodos();
        renderTodos();
        updateStats();
    }
}

// 할일 완료 상태 토글
function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        // Firebase에 완료 상태 반영 (id가 Firebase key일 때)
        if (typeof id === 'string') {
            update(ref(db, `todos/${id}`), { completed: todo.completed }).catch(() => {});
        }
        saveTodos();
        renderTodos();
        updateStats();
    }
}

// 할일 수정 모드 시작
function startEdit(id) {
    // ID를 문자열로 변환하여 일관성 유지
    editingId = String(id);
    renderTodos();
    
    // 수정 입력란에 포커스 (약간의 딜레이 후 실행)
    setTimeout(() => {
        const editInput = document.querySelector(`[data-edit-id="${editingId}"]`);
        if (editInput) {
            editInput.focus();
            editInput.select();
        }
    }, 10);
}

// 할일 수정 저장
function saveEdit(id) {
    // ID를 문자열로 변환하여 일관성 유지
    const idStr = String(id);
    const editInput = document.querySelector(`[data-edit-id="${idStr}"]`);
    if (!editInput) return;

    const newText = editInput.value.trim();
    
    if (newText === '') {
        alert('할일 내용을 입력해주세요!');
        return;
    }

    // 타입 불일치를 방지하기 위해 문자열로 변환하여 비교
    const todo = todos.find(t => String(t.id) === idStr);
    if (todo) {
        todo.text = newText;
        // Firebase에 내용 수정 반영 (id가 Firebase key일 때, 숫자가 아닌 문자열인 경우)
        if (idStr && !idStr.match(/^\d+$/)) {
            update(ref(db, `todos/${idStr}`), { text: newText }).catch(() => {});
        }
        saveTodos();
        editingId = null;
        renderTodos();
        updateStats();
    }
}

// 할일 수정 취소
function cancelEdit() {
    editingId = null;
    renderTodos();
}

// 할일 목록 렌더링
function renderTodos() {
    todoList.innerHTML = '';

    if (todos.length === 0) {
        emptyState.classList.add('show');
        return;
    }

    emptyState.classList.remove('show');

    todos.forEach(todo => {
        const todoItem = document.createElement('div');
        todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        todoItem.setAttribute('data-id', todo.id);

        // 타입 불일치 방지를 위해 문자열로 변환하여 비교
        if (String(editingId) === String(todo.id)) {
            // 수정 모드 - data 속성 사용
            todoItem.innerHTML = `
                <input type="text" 
                    class="todo-text editing" 
                    value="${escapeHtml(todo.text)}"
                    data-edit-id="${todo.id}"
                >
                <button class="save-btn" data-todo-id="${todo.id}">저장</button>
                <button class="cancel-btn">취소</button>
            `;
            
            // 저장/취소 버튼에 이벤트 리스너 추가
            const saveBtn = todoItem.querySelector('.save-btn');
            const cancelBtn = todoItem.querySelector('.cancel-btn');
            
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    saveEdit(todo.id);
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    cancelEdit();
                });
            }
        } else {
            // 일반 모드 - data 속성 사용
            todoItem.innerHTML = `
                <input 
                    type="checkbox" 
                    class="todo-checkbox" 
                    ${todo.completed ? 'checked' : ''}
                    data-todo-id="${todo.id}"
                >
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                <button class="edit-btn" data-todo-id="${todo.id}">수정</button>
                <button class="delete-btn" data-todo-id="${todo.id}">삭제</button>
            `;
        }

        todoList.appendChild(todoItem);
        
        // 일반 모드일 때만 이벤트 리스너 추가
        if (String(editingId) !== String(todo.id)) {
            const checkbox = todoItem.querySelector('.todo-checkbox');
            const editBtn = todoItem.querySelector('.edit-btn');
            const deleteBtn = todoItem.querySelector('.delete-btn');
            
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    toggleTodo(todo.id);
                });
            }
            
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    startEdit(todo.id);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteTodo(todo.id);
                });
            }
        }
    });

    // 수정 모드에서 엔터 키로 저장, ESC로 취소
    if (editingId) {
        const editInput = document.querySelector(`[data-edit-id="${editingId}"]`);
        if (editInput) {
            editInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    saveEdit(editingId);
                } else if (e.key === 'Escape') {
                    cancelEdit();
                }
            });
        }
    }
}

// 통계 업데이트
function updateStats() {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const remaining = total - completed;

    totalCount.textContent = total;
    completedCount.textContent = completed;
    remainingCount.textContent = remaining;
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 이벤트 리스너
addBtn.addEventListener('click', addTodo);

todoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addTodo();
    }
});

// HTML inline 이벤트 핸들러에서 접근할 수 있도록 전역에 바인딩
window.addTodo = addTodo;
window.deleteTodo = deleteTodo;
window.toggleTodo = toggleTodo;
window.startEdit = startEdit;
window.saveEdit = saveEdit;
window.cancelEdit = cancelEdit;

