// Expense Tracker Application
class ExpenseTracker {
    constructor() {
        this.transactions = [];
        this.currentFormType = 'expense';
        this.supabase = null;
        this.init();
    }

    init() {
        this.initSupabase();
        this.setupEventListeners();
        this.setDefaultDate();
        this.loadTransactions();
    }

    async initSupabase() {
        // Initialize Supabase client for database connection only
        this.supabase = supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
        
        // Load existing transactions from database
        await this.loadTransactions();
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        // Filter changes
        document.getElementById('filterTransactionType').addEventListener('change', () => this.renderTransactions());
        document.getElementById('filterCategory').addEventListener('change', () => this.renderTransactions());
        document.getElementById('filterType').addEventListener('change', () => this.renderTransactions());
        
        // Form toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleFormType(e.target.dataset.type));
        });

        // Export and clear buttons
        document.getElementById('exportBtn').addEventListener('click', () => this.exportToExcel());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllData());
        
        // Cancel edit button
        document.getElementById('cancelEditBtn').addEventListener('click', () => this.cancelEdit());
        
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToView(item.dataset.view);
            });
        });
        
        // Mobile menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }











    toggleFormType(type) {
        this.currentFormType = type;
        
        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        
        // Update form title
        const formTitle = document.getElementById('formTitle');
        formTitle.textContent = type === 'expense' ? 'Add New Expense' : 'Add New Income';
        
        // Show/hide income-specific fields
        const incomeFields = document.querySelectorAll('.income-field');
        incomeFields.forEach(field => {
            field.style.display = type === 'income' ? 'block' : 'none';
        });
        
        // Update category options for income
        this.updateCategoryOptions(type);
        
        // Reset form
        this.resetForm();
    }

    updateCategoryOptions(type) {
        const categorySelect = document.getElementById('filterCategory');
        const currentValue = categorySelect.value;
        
        if (type === 'income') {
            // Add income categories
            if (!categorySelect.querySelector('option[value="salary"]')) {
                const incomeOptions = [
                    { value: 'salary', text: 'Salary' },
                    { value: 'client', text: 'Client Payment' },
                    { value: 'investment', text: 'Investment' },
                    { value: 'other-income', text: 'Other Income' }
                ];
                
                incomeOptions.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option.value;
                    optionElement.textContent = option.text;
                    categorySelect.appendChild(optionElement);
                });
            }
        }
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
    }

    async addExpense() {
        const formData = new FormData(document.getElementById('expenseForm'));
        const form = document.getElementById('expenseForm');
        const isEditing = form.dataset.editing === 'true';
        const editingId = parseInt(form.dataset.editingId);
        
        const transaction = {
            type: this.currentFormType,
            amount: parseFloat(formData.get('amount')),
            description: formData.get('description'),
            category: formData.get('category'),
            transaction_type: formData.get('type'), // personal/business
            date: formData.get('date'),
            source: formData.get('source') || ''
        };

        try {
            if (isEditing) {
                // Update existing transaction
                const { error } = await this.supabase
                    .from('transactions')
                    .update(transaction)
                    .eq('id', editingId);

                if (error) throw error;
                this.showNotification(`${this.currentFormType === 'expense' ? 'Expense' : 'Income'} updated successfully!`, 'success');
            } else {
                // Add new transaction
                const { error } = await this.supabase
                    .from('transactions')
                    .insert([transaction]);

                if (error) throw error;
                this.showNotification(`${this.currentFormType === 'expense' ? 'Expense' : 'Income'} added successfully!`, 'success');
            }

            await this.loadTransactions();
            this.resetForm();
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    resetForm() {
        const form = document.getElementById('expenseForm');
        form.reset();
        this.setDefaultDate();
        
        // Reset editing state
        form.dataset.editing = 'false';
        form.dataset.editingId = '';
        
        // Update button text
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
        
        // Update form title
        document.querySelector('.add-transaction-section h2').textContent = 'Add New Expense';
        
        // Hide cancel button
        document.getElementById('cancelEditBtn').style.display = 'none';
    }

    async deleteExpense(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            try {
                const { error } = await this.supabase
                    .from('transactions')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                
                this.showNotification('Transaction deleted successfully!', 'success');
                await this.loadTransactions();
            } catch (error) {
                this.showNotification(error.message, 'error');
            }
        }
    }

    editExpense(expense) {
        const form = document.getElementById('expenseForm');
        
        // Set editing state
        form.dataset.editing = 'true';
        form.dataset.editingId = expense.id;
        
        // Fill form with expense data
        document.getElementById('amount').value = expense.amount;
        document.getElementById('description').value = expense.description;
        document.getElementById('category').value = expense.category;
        document.getElementById('type').value = expense.type;
        document.getElementById('date').value = expense.date;
        
        // Update button text and form title
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Expense';
        
        document.querySelector('.add-transaction-section h2').textContent = 'Edit Expense';
        
        // Show cancel button
        document.getElementById('cancelEditBtn').style.display = 'block';
        
        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth' });
        
        this.showNotification('Editing expense - make changes and click Update', 'info');
    }

    cancelEdit() {
        this.resetForm();
        this.showNotification('Edit cancelled', 'info');
    }

    navigateToView(viewName) {
        // Hide all views
        document.getElementById('mainView').style.display = 'none';
        document.getElementById('dashboardView').style.display = 'none';
        document.getElementById('historyView').style.display = 'none';
        
        // Show selected view
        document.getElementById(viewName + 'View').style.display = 'block';
        
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
        
        // Update top bar title
        const titles = {
            main: 'Add Transaction',
            dashboard: 'Financial Dashboard',
            history: 'Transaction History'
        };
        document.querySelector('.top-bar h1').textContent = titles[viewName];
        
        // Close mobile menu
        document.getElementById('sidebar').classList.remove('open');
        
        // Render appropriate content
        if (viewName === 'dashboard') {
            this.updateSummary(); // Update today's summary cards
            this.renderDashboard();
        } else if (viewName === 'history') {
            this.renderTransactions();
        }
    }

    renderDashboard() {
        const currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
        
        const monthIncome = this.transactions
            .filter(transaction => transaction.date.startsWith(currentMonth) && transaction.type === 'income')
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        
        const monthExpenses = this.transactions
            .filter(transaction => transaction.date.startsWith(currentMonth) && transaction.type === 'expense')
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        
        const monthBalance = monthIncome - monthExpenses;

        document.getElementById('monthIncome').textContent = `₹${monthIncome.toFixed(2)}`;
        document.getElementById('monthExpenses').textContent = `₹${monthExpenses.toFixed(2)}`;
        document.getElementById('monthBalance').textContent = `₹${monthBalance.toFixed(2)}`;
        
        // Render recent transactions
        const recentTransactions = this.transactions.slice(0, 5);
        const recentContainer = document.getElementById('recentTransactions');
        
        if (recentTransactions.length === 0) {
            recentContainer.innerHTML = '<p class="empty-state">No transactions yet</p>';
        } else {
            recentContainer.innerHTML = recentTransactions.map(transaction => 
                `<div class="recent-transaction">
                    <div class="recent-amount ${transaction.type}">${transaction.type === 'income' ? '+' : '-'}₹${transaction.amount.toFixed(2)}</div>
                    <div class="recent-desc">${transaction.description}</div>
                    <div class="recent-date">${new Date(transaction.date).toLocaleDateString('en-IN')}</div>
                </div>`
            ).join('');
        }
    }

    updateSummary() {
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
        
        const todayIncome = this.transactions
            .filter(transaction => transaction.date === today && transaction.type === 'income')
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        
        const todayExpenses = this.transactions
            .filter(transaction => transaction.date === today && transaction.type === 'expense')
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        
        const todayBalance = todayIncome - todayExpenses;
        
        const monthIncome = this.transactions
            .filter(transaction => transaction.date.startsWith(currentMonth) && transaction.type === 'income')
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        
        const monthExpenses = this.transactions
            .filter(transaction => transaction.date.startsWith(currentMonth) && transaction.type === 'expense')
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        
        const monthBalance = monthIncome - monthExpenses;

        document.getElementById('todayIncome').textContent = `₹${todayIncome.toFixed(2)}`;
        document.getElementById('todayExpenses').textContent = `₹${todayExpenses.toFixed(2)}`;
        document.getElementById('todayBalance').textContent = `₹${todayBalance.toFixed(2)}`;
        document.getElementById('monthBalance').textContent = `₹${monthBalance.toFixed(2)}`;
    }

    renderTransactions() {
        const transactionsList = document.getElementById('transactionsList');
        const filterTransactionType = document.getElementById('filterTransactionType').value;
        const filterCategory = document.getElementById('filterCategory').value;
        const filterType = document.getElementById('filterType').value;

        let filteredTransactions = this.transactions;

        // Apply filters
        if (filterTransactionType) {
            filteredTransactions = filteredTransactions.filter(transaction => transaction.type === filterTransactionType);
        }
        if (filterCategory) {
            filteredTransactions = filteredTransactions.filter(transaction => transaction.category === filterCategory);
        }
        if (filterType) {
            filteredTransactions = filteredTransactions.filter(transaction => transaction.transactionType === filterType);
        }

        if (filteredTransactions.length === 0) {
            transactionsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No transactions found</h3>
                    <p>${this.transactions.length === 0 ? 'Start by adding your first transaction above!' : 'No transactions match the current filters.'}</p>
                </div>
            `;
            return;
        }

        transactionsList.innerHTML = filteredTransactions.map(transaction => this.createTransactionHTML(transaction)).join('');
        
        // Add delete and edit event listeners
        filteredTransactions.forEach(transaction => {
            const deleteBtn = document.querySelector(`[data-id="${transaction.id}"].delete-btn`);
            const editBtn = document.querySelector(`[data-id="${transaction.id}"].edit-btn`);
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteExpense(transaction.id));
            }
            if (editBtn) {
                editBtn.addEventListener('click', () => this.editExpense(transaction));
            }
        });
    }

    createTransactionHTML(transaction) {
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        const isIncome = transaction.type === 'income';
        const amountClass = isIncome ? 'income' : 'expense';
        const amountPrefix = isIncome ? '+' : '-';

        return `
            <div class="expense-item ${isIncome ? 'income-item' : ''}">
                <div class="expense-header">
                    <div class="expense-amount ${amountClass}">${amountPrefix}₹${transaction.amount.toFixed(2)}</div>
                    <div class="expense-date">${formattedDate}</div>
                </div>
                <div class="expense-description">${transaction.description}</div>
                ${transaction.source ? `<div class="expense-source">From: ${transaction.source}</div>` : ''}
                <div class="expense-meta">
                    <span class="expense-category">${this.getCategoryDisplayName(transaction.category)}</span>
                    <span class="expense-type ${transaction.transactionType}">${transaction.transactionType}</span>
                    <span class="transaction-type-badge ${transaction.type}">${transaction.type}</span>
                    <div class="expense-actions">
                        <button class="edit-btn" data-id="${transaction.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="delete-btn" data-id="${transaction.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getCategoryDisplayName(category) {
        const categoryNames = {
            'food': 'Food & Groceries',
            'transport': 'Transport',
            'utilities': 'Utilities',
            'business': 'Business',
            'health': 'Health & Medical',
            'entertainment': 'Entertainment',
            'other': 'Other'
        };
        return categoryNames[category] || category;
    }

    exportToExcel() {
        if (this.transactions.length === 0) {
            this.showNotification('No transactions to export!', 'error');
            return;
        }

        // Create CSV content
        const headers = ['Date', 'Type', 'Amount', 'Description', 'Category', 'Transaction Type', 'Source'];
        const csvContent = [
            headers.join(','),
            ...this.transactions.map(transaction => [
                transaction.date,
                transaction.type,
                transaction.amount,
                `"${transaction.description}"`,
                transaction.category,
                transaction.transactionType,
                transaction.source || ''
            ].join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Transactions exported successfully!', 'success');
    }

    async loadTransactions() {
        try {
            const { data, error } = await this.supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.transactions = data || [];
            this.updateSummary();
            this.renderTransactions();
            this.renderDashboard();
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async clearAllData() {
        if (confirm('Are you sure you want to delete ALL transactions? This action cannot be undone!')) {
            try {
                const { error } = await this.supabase
                    .from('transactions')
                    .delete();

                if (error) throw error;

                this.transactions = [];
                this.updateSummary();
                this.renderTransactions();
                this.renderDashboard();
                this.showNotification('All transactions cleared!', 'success');
            } catch (error) {
                this.showNotification(error.message, 'error');
            }
        }
    }

    async exportToExcel() {
        if (this.transactions.length === 0) {
            this.showNotification('No transactions to export!', 'error');
            return;
        }

        // Create CSV content
        const headers = ['Date', 'Type', 'Amount', 'Description', 'Category', 'Transaction Type', 'Source'];
        const csvContent = [
            headers.join(','),
            ...this.transactions.map(transaction => [
                transaction.date,
                transaction.type,
                transaction.amount,
                `"${transaction.description}"`,
                transaction.category,
                transaction.transaction_type,
                transaction.source || ''
            ].join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Transactions exported successfully!', 'success');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 500;
            transform: translateX(400px);
            transition: transform 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ExpenseTracker();
});

// Add some sample data for demonstration (remove this in production)
function addSampleData() {
    const sampleTransactions = [
        {
            id: Date.now() - 1,
            type: 'expense',
            amount: 150.00,
            description: 'Grocery shopping',
            category: 'food',
            transactionType: 'personal',
            date: new Date().toISOString().split('T')[0],
            source: '',
            timestamp: new Date().toISOString()
        },
        {
            id: Date.now() - 2,
            type: 'expense',
            amount: 500.00,
            description: 'Office supplies',
            category: 'business',
            transactionType: 'business',
            date: new Date().toISOString().split('T')[0],
            source: '',
            timestamp: new Date().toISOString()
        },
        {
            id: Date.now() - 3,
            type: 'income',
            amount: 5000.00,
            description: 'Client payment for website design',
            category: 'client',
            transactionType: 'business',
            date: new Date().toISOString().split('T')[0],
            source: 'ABC Company',
            timestamp: new Date().toISOString()
        }
    ];

    const tracker = new ExpenseTracker();
    if (tracker.transactions.length === 0) {
        tracker.transactions = sampleTransactions;
        tracker.saveToLocalStorage();
        tracker.updateSummary();
        tracker.renderTransactions();
    }
}

// Uncomment the line below to add sample data for testing
// addSampleData(); 