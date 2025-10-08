import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export interface LoginUser {
  id?: number;
  email: string;
  name?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
  [key: string]: unknown;
}

export interface Account {
  id: number;
  client: string | null;
  company: number | null;
  category: string | null;
  class1: string | null;
  class2: string | null;
  code: string;
  numero: string;
  bankID: number | null;
  alias: string;
  balance: number;
  currency: string;
  user: number | null;
  user2: number | null;
  cartola: string | null;
  account: string | null;
  active: number;
  viewBalance: boolean;
  debitAccount: boolean;
  creditAccount: boolean;
  date_created: string | null;
  date_updated: string | null;
  account_type?: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  incomplete_transactions_count?: number;
}

export interface Transaction {
  id: number;
  conciled: boolean | null;
  client: string;
  company: number;
  name: string;
  category: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balancedebit: number | null;
  balancecredit: number | null;
  debitacc: string;
  creditacc: string;
  fecha: string;
  status: string | null;
  bank_transaction_id: string | null;
  accounting_date: string | null;
  // Additional fields from join
  transaction_type: 'debit' | 'credit';
  other_account_code: string;
  other_account_alias: string | null;
  other_account_type?: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  classification?: 'income' | 'expense' | 'transfer';
  is_incomplete?: boolean;
}

export interface StatementTransaction {
  id?: string; // Temporary ID for frontend
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  category?: string;
  balance?: number;
}

export interface BankStatement {
  accountId: number;
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  transactions: StatementTransaction[];
}

export async function getUserByEmail(email: string): Promise<LoginUser | null> {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM login WHERE email = ?',
      [email]
    );

    const users = rows as LoginUser[];
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch user from database');
  }
}

export async function createUser(email: string, additionalData: Partial<LoginUser> = {}): Promise<LoginUser> {
  try {
    const userData = {
      email,
      created_at: new Date(),
      updated_at: new Date(),
      ...additionalData
    };

    const columns = Object.keys(userData);
    const values = Object.values(userData);
    const placeholders = columns.map(() => '?').join(', ');

    const [result] = await pool.execute(
      `INSERT INTO login (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    const insertResult = result as mysql.ResultSetHeader;
    return { id: insertResult.insertId, ...userData };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to create user in database');
  }
}

export async function updateUser(email: string, updateData: Partial<LoginUser>): Promise<LoginUser | null> {
  try {
    const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), email];

    await pool.execute(
      `UPDATE login SET ${updateFields}, updated_at = NOW() WHERE email = ?`,
      values
    );

    return getUserByEmail(email);
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to update user in database');
  }
}

export async function getAccountsByUserId(userId: number): Promise<Account[]> {
  try {
    const [rows] = await pool.execute(
      `SELECT
        a.*,
        COALESCE(it.incomplete_count, 0) as incomplete_transactions_count
      FROM rv_cuentas a
      LEFT JOIN (
        SELECT
          CASE
            WHEN debitacc = '0' THEN creditacc
            WHEN creditacc = '0' THEN debitacc
          END as account_code,
          COUNT(*) as incomplete_count
        FROM rv_transaction
        WHERE (debitacc = '0' OR creditacc = '0')
          AND debitacc != creditacc
        GROUP BY account_code
      ) it ON a.code = it.account_code
      WHERE a.user = ?
      ORDER BY a.alias ASC`,
      [userId]
    );

    return rows as Account[];
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch accounts from database');
  }
}

export async function getAccountsByUserEmail(email: string): Promise<Account[]> {
  try {
    // First get the user ID from the login table
    const user = await getUserByEmail(email);
    if (!user || !user.id) {
      return [];
    }

    // Then get the accounts for that user
    return getAccountsByUserId(user.id);
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch accounts for user');
  }
}

export async function getAccountById(accountId: number): Promise<any> {
  try {
    const [rows] = await pool.execute(
      `SELECT
        id as account_id,
        code as account_code,
        alias as account_name,
        category,
        account_type,
        currency as currency_code,
        balance as current_balance,
        CASE WHEN active = 1 THEN 'Active' ELSE 'Inactive' END as account_status,
        date_created as created_at,
        date_updated as updated_at
      FROM rv_cuentas
      WHERE id = ?`,
      [accountId]
    );

    const accounts = rows as any[];
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch account details from database');
  }
}

export async function updateAccount(
  accountId: number,
  updates: {
    account_name?: string;
    category?: string;
    account_type?: string;
    account_status?: string;
    currency_code?: string;
  },
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // First verify the account belongs to the user
    const [verifyRows] = await pool.execute(
      'SELECT id FROM rv_cuentas WHERE id = ? AND user = ?',
      [accountId, userId]
    );

    if ((verifyRows as any[]).length === 0) {
      return { success: false, error: 'Account not found or access denied' };
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: (string | number)[] = [];

    if (updates.account_name !== undefined) {
      updateFields.push('alias = ?');
      updateValues.push(updates.account_name);
    }

    if (updates.category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(updates.category);
    }

    if (updates.account_type !== undefined) {
      updateFields.push('account_type = ?');
      updateValues.push(updates.account_type);
    }

    if (updates.account_status !== undefined) {
      updateFields.push('active = ?');
      updateValues.push(updates.account_status === 'Active' ? 1 : 0);
    }

    if (updates.currency_code !== undefined) {
      updateFields.push('currency = ?');
      updateValues.push(updates.currency_code);
    }

    if (updateFields.length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    // Always update the date_updated field
    updateFields.push('date_updated = NOW()');

    // Execute update
    const updateQuery = `UPDATE rv_cuentas SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(accountId);

    await pool.execute(updateQuery, updateValues);

    return { success: true };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: 'Failed to update account' };
  }
}

export async function createAccount(accountData: {
  code: string;
  alias: string;
  category: string;
  currency: string;
  balance: number;
  active: number;
  userId: number;
}): Promise<any> {
  try {
    const [result] = await pool.execute(
      `INSERT INTO rv_cuentas (
        code, alias, category, currency, balance, active, user,
        date_created, date_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        accountData.code,
        accountData.alias,
        accountData.category,
        accountData.currency,
        accountData.balance,
        accountData.active,
        accountData.userId
      ]
    );

    const insertResult = result as mysql.ResultSetHeader;

    // Return the created account
    return {
      id: insertResult.insertId,
      code: accountData.code,
      alias: accountData.alias,
      category: accountData.category,
      currency: accountData.currency,
      balance: accountData.balance,
      active: accountData.active,
      user: accountData.userId
    };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to create account in database');
  }
}

// Helper function to classify transactions based on account types
export function classifyTransaction(
  transactionType: 'debit' | 'credit',
  otherAccountType: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | null | undefined
): 'income' | 'expense' | 'transfer' {
  if (!otherAccountType) return 'transfer';

  // For the main account perspective:
  // - Money coming IN from income accounts = income
  // - Money going OUT to expense accounts = expense
  // - Money moving between asset/liability/equity accounts = transfer

  if (transactionType === 'credit') {
    // Money coming INTO the main account
    if (otherAccountType === 'income') return 'income';
    if (otherAccountType === 'expense') return 'income'; // Expense refund/reversal
    return 'transfer';
  } else {
    // Money going OUT of the main account
    if (otherAccountType === 'expense') return 'expense';
    if (otherAccountType === 'income') return 'expense'; // Income adjustment/reversal
    return 'transfer';
  }
}

export async function getTransactionsByAccountCode(accountCode: string, limit: number = 100, offset: number = 0): Promise<Transaction[]> {
  try {
    // Ensure limit and offset are integers
    const limitInt = Math.max(1, Math.min(500, parseInt(String(limit))));
    const offsetInt = Math.max(0, parseInt(String(offset)));

    console.log('Executing query with accountCode:', accountCode, 'limit:', limitInt, 'offset:', offsetInt);

    // Simplified query using string concatenation for LIMIT/OFFSET to avoid parameter issues
    const query = `
      SELECT
        t.*,
        CASE
          WHEN t.debitacc = ? THEN 'debit'
          ELSE 'credit'
        END as transaction_type,
        CASE
          WHEN t.debitacc = ? THEN t.creditacc
          ELSE t.debitacc
        END as other_account_code,
        CASE
          WHEN t.debitacc = ? THEN c_credit.alias
          ELSE c_debit.alias
        END as other_account_alias,
        CASE
          WHEN t.debitacc = ? THEN c_credit.account_type
          ELSE c_debit.account_type
        END as other_account_type,
        comp.id as entity_id,
        comp.name as entity_name,
        comp.code as entity_code
      FROM rv_transaction t
      LEFT JOIN rv_cuentas c_debit ON t.debitacc = c_debit.code
      LEFT JOIN rv_cuentas c_credit ON t.creditacc = c_credit.code
      LEFT JOIN company comp ON t.company = comp.id
      WHERE t.debitacc = ? OR t.creditacc = ?
      ORDER BY t.fecha DESC, t.id DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;

    const [rows] = await pool.execute(query, [
      accountCode, // for transaction_type CASE
      accountCode, // for other_account_code CASE
      accountCode, // for other_account_alias CASE
      accountCode, // for other_account_type CASE
      accountCode, // for WHERE debitacc
      accountCode  // for WHERE creditacc
    ]);

    console.log(`Found ${(rows as any[]).length} transactions`);

    // Add classification to each transaction
    const transactions = (rows as Transaction[]).map(transaction => ({
      ...transaction,
      classification: classifyTransaction(
        transaction.transaction_type,
        transaction.other_account_type
      )
    }));

    return transactions;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch transactions for account');
  }
}

export async function getTransactionsByAccountId(accountId: number, limit: number = 100, offset: number = 0): Promise<Transaction[]> {
  try {
    // First get the account code
    const [accountRows] = await pool.execute(
      'SELECT code FROM rv_cuentas WHERE id = ?',
      [accountId]
    );

    const accounts = accountRows as { code: string }[];
    if (accounts.length === 0) {
      return [];
    }

    return getTransactionsByAccountCode(accounts[0].code, limit, offset);
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch transactions for account ID');
  }
}

export async function createReconciliationTransaction(
  accountId: number,
  reconciliationData: {
    bankBalance: number;
    reconciliationDate: string;
    description?: string;
  }
): Promise<{ success: boolean; transaction?: { id: number; previousBalance: number; newBalance: number; difference: number }; error?: string }> {
  try {
    // Get account details
    const [accountRows] = await pool.execute(
      'SELECT * FROM rv_cuentas WHERE id = ?',
      [accountId]
    );

    const accounts = accountRows as Account[];
    if (accounts.length === 0) {
      return { success: false, error: 'Account not found' };
    }

    const account = accounts[0];
    const currentBalance = account.balance;
    const difference = reconciliationData.bankBalance - currentBalance;

    if (Math.abs(difference) < 0.01) {
      return { success: true, error: 'Account is already reconciled - no adjustment needed' };
    }

    // Create reconciliation transaction
    const transactionData = {
      conciled: 1,
      client: account.client || 'System',
      company: account.company || 1,
      name: 'Bank Reconciliation',
      category: 'Reconciliation',
      description: reconciliationData.description || `Bank statement reconciliation - Balance adjustment`,
      debit: Math.abs(difference),
      credit: Math.abs(difference),
      balancedebit: difference < 0 ? reconciliationData.bankBalance : null,
      balancecredit: difference > 0 ? reconciliationData.bankBalance : null,
      debitacc: difference < 0 ? account.code : '0',
      creditacc: difference > 0 ? account.code : '0',
      fecha: reconciliationData.reconciliationDate,
      status: 'Completed',
      accounting_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };

    // Insert the reconciliation transaction
    const insertQuery = `
      INSERT INTO rv_transaction
      (conciled, client, company, name, category, description, debit, credit, balancedebit, balancecredit, debitacc, creditacc, fecha, status, accounting_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(insertQuery, [
      transactionData.conciled,
      transactionData.client,
      transactionData.company,
      transactionData.name,
      transactionData.category,
      transactionData.description,
      transactionData.debit,
      transactionData.credit,
      transactionData.balancedebit,
      transactionData.balancecredit,
      transactionData.debitacc,
      transactionData.creditacc,
      transactionData.fecha,
      transactionData.status,
      transactionData.accounting_date
    ]);

    // Update the account balance
    await pool.execute(
      'UPDATE rv_cuentas SET balance = ?, date_updated = NOW() WHERE id = ?',
      [reconciliationData.bankBalance, accountId]
    );

    const insertResult = result as mysql.ResultSetHeader;

    return {
      success: true,
      transaction: {
        id: insertResult.insertId,
        difference: difference,
        previousBalance: currentBalance,
        newBalance: reconciliationData.bankBalance,
        ...transactionData
      }
    };

  } catch (error) {
    console.error('Reconciliation error:', error);
    return { success: false, error: 'Failed to create reconciliation transaction' };
  }
}

export async function getAccountBalance(accountId: number): Promise<{ balance: number; currency: string } | null> {
  try {
    const [rows] = await pool.execute(
      'SELECT balance, currency FROM rv_cuentas WHERE id = ?',
      [accountId]
    );

    const accounts = rows as { balance: number; currency: string }[];
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch account balance');
  }
}

export async function importBankStatement(
  statement: BankStatement
): Promise<{ success: boolean; transactions?: Array<{ id: number; [key: string]: unknown }>; error?: string }> {
  try {
    // Get account details
    const [accountRows] = await pool.execute(
      'SELECT * FROM rv_cuentas WHERE id = ?',
      [statement.accountId]
    );

    const accounts = accountRows as Account[];
    if (accounts.length === 0) {
      return { success: false, error: 'Account not found' };
    }

    const account = accounts[0];
    const accountType = account.category; // 'asset', 'liability', 'equity', 'income', 'expense'

    // Validate account type exists
    if (!accountType) {
      return {
        success: false,
        error: 'Account type is not set. Please set the account type before importing statements.'
      };
    }

    // Validate that the statement balances correctly
    // Running balance is calculated by simply adding all amounts (positive and negative)
    let runningBalance = statement.openingBalance;
    for (const transaction of statement.transactions) {
      runningBalance += transaction.amount;
    }

    if (Math.abs(runningBalance - statement.closingBalance) > 0.01) {
      return {
        success: false,
        error: `Statement doesn't balance. Expected: ${statement.closingBalance}, Calculated: ${runningBalance.toFixed(2)}`
      };
    }

    const createdTransactions = [];
    const accountingDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Create opening balance adjustment if needed
    if (Math.abs(account.balance - statement.openingBalance) > 0.01) {
      const balanceDifference = statement.openingBalance - account.balance;

      // Determine debit/credit based on account type and balance difference
      let debitacc = '0';
      let creditacc = '0';
      let balancedebit = null;
      let balancecredit = null;

      // DEBIT increases: Assets, Expenses
      // CREDIT increases: Liabilities, Equity, Income
      const debitIncreasesBalance = accountType === 'asset' || accountType === 'expense';

      if (debitIncreasesBalance) {
        if (balanceDifference > 0) {
          // Need to increase → DEBIT account
          debitacc = account.code;
          balancedebit = statement.openingBalance;
        } else {
          // Need to decrease → CREDIT account
          creditacc = account.code;
          balancecredit = statement.openingBalance;
        }
      } else {
        // Credit increases balance (liability, equity, income, contra accounts)
        if (balanceDifference > 0) {
          // Need to increase → CREDIT account
          creditacc = account.code;
          balancecredit = statement.openingBalance;
        } else {
          // Need to decrease → DEBIT account
          debitacc = account.code;
          balancedebit = statement.openingBalance;
        }
      }

      const openingAdjustment = {
        conciled: 1,
        client: account.client || 'System',
        company: account.company || 1,
        name: 'Opening Balance Adjustment',
        category: 'Statement Import',
        description: `Opening balance adjustment for statement dated ${statement.statementDate}`,
        debit: Math.abs(balanceDifference),
        credit: Math.abs(balanceDifference),
        balancedebit: balancedebit,
        balancecredit: balancecredit,
        debitacc: debitacc,
        creditacc: creditacc,
        fecha: statement.statementDate,
        status: 'Statement Import',
        accounting_date: accountingDate
      };

      const [openingResult] = await pool.execute(`
        INSERT INTO rv_transaction
        (conciled, client, company, name, category, description, debit, credit, balancedebit, balancecredit, debitacc, creditacc, fecha, status, accounting_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        openingAdjustment.conciled, openingAdjustment.client, openingAdjustment.company,
        openingAdjustment.name, openingAdjustment.category, openingAdjustment.description,
        openingAdjustment.debit, openingAdjustment.credit, openingAdjustment.balancedebit,
        openingAdjustment.balancecredit, openingAdjustment.debitacc, openingAdjustment.creditacc,
        openingAdjustment.fecha, openingAdjustment.status, openingAdjustment.accounting_date
      ]);

      const openingResultInsert = openingResult as mysql.ResultSetHeader;
      createdTransactions.push({ id: openingResultInsert.insertId, ...openingAdjustment });
    }

    // Create all statement transactions
    let currentBalance = statement.openingBalance;

    for (const statementTxn of statement.transactions) {
      // Determine which account field to populate based on transaction type
      let debitacc = '0';
      let creditacc = '0';
      let balancedebit = null;
      let balancecredit = null;

      // Amount should already be absolute value from frontend
      const amount = Math.abs(statementTxn.amount);

      // Use the transaction type sent from frontend
      // Frontend has already determined correct type based on account type and amount sign
      if (statementTxn.type === 'debit') {
        // DEBIT this account
        debitacc = account.code;
        currentBalance += amount;
        balancedebit = currentBalance;
      } else {
        // CREDIT this account
        creditacc = account.code;
        currentBalance -= amount;
        balancecredit = currentBalance;
      }

      const transactionData = {
        conciled: 1,
        client: account.client || 'System',
        company: account.company || 1,
        name: statementTxn.description,
        category: statementTxn.category || 'Bank Transaction',
        description: `Bank statement transaction - ${statementTxn.description}`,
        debit: amount,
        credit: amount,
        balancedebit: balancedebit,
        balancecredit: balancecredit,
        debitacc: debitacc,
        creditacc: creditacc,
        fecha: statementTxn.date,
        status: 'Statement Import',
        accounting_date: accountingDate
      };

      const [result] = await pool.execute(`
        INSERT INTO rv_transaction
        (conciled, client, company, name, category, description, debit, credit, balancedebit, balancecredit, debitacc, creditacc, fecha, status, accounting_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transactionData.conciled, transactionData.client, transactionData.company,
        transactionData.name, transactionData.category, transactionData.description,
        transactionData.debit, transactionData.credit, transactionData.balancedebit,
        transactionData.balancecredit, transactionData.debitacc, transactionData.creditacc,
        transactionData.fecha, transactionData.status, transactionData.accounting_date
      ]);

      const resultInsert = result as mysql.ResultSetHeader;
      createdTransactions.push({ id: resultInsert.insertId, ...transactionData });
    }

    // Update the account balance to the closing balance
    await pool.execute(
      'UPDATE rv_cuentas SET balance = ?, date_updated = NOW() WHERE id = ?',
      [statement.closingBalance, statement.accountId]
    );

    return {
      success: true,
      transactions: createdTransactions
    };

  } catch (error) {
    console.error('Statement import error:', error);
    return { success: false, error: 'Failed to import bank statement' };
  }
}

// Reporting functions for expense/income analysis
export async function getTransactionSummaryByAccount(
  accountCode: string,
  startDate?: string,
  endDate?: string
): Promise<{
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  incomeTransactions: number;
  expenseTransactions: number;
  transferTransactions: number;
}> {
  try {
    const dateFilter = '';

    const query = `
      SELECT
        t.*,
        CASE
          WHEN t.debitacc = ? THEN 'debit'
          ELSE 'credit'
        END as transaction_type,
        CASE
          WHEN t.debitacc = ? THEN c_credit.account_type
          ELSE c_debit.account_type
        END as other_account_type,
        CASE
          WHEN t.debitacc = ? THEN t.credit
          ELSE t.debit
        END as amount
      FROM rv_transaction t
      LEFT JOIN rv_cuentas c_debit ON t.debitacc = c_debit.code
      LEFT JOIN rv_cuentas c_credit ON t.creditacc = c_credit.code
      WHERE (t.debitacc = ? OR t.creditacc = ?)${startDate && endDate ? ' AND t.fecha BETWEEN ? AND ?' : ''}
      ORDER BY t.fecha DESC
    `;

    // Build parameters array in the correct order
    const queryParams = [
      accountCode,  // for transaction_type CASE
      accountCode,  // for other_account_type CASE
      accountCode,  // for amount CASE
      accountCode,  // for WHERE debitacc
      accountCode   // for WHERE creditacc
    ];

    if (startDate && endDate) {
      queryParams.push(startDate, endDate);
    }

    console.log('Query params:', queryParams);
    const [rows] = await pool.execute(query, queryParams);
    const transactions = rows as Array<Transaction & { transaction_type: string; other_account_type: string; amount: string }>;

    let totalIncome = 0;
    let totalExpenses = 0;
    let incomeTransactions = 0;
    let expenseTransactions = 0;
    let transferTransactions = 0;

    transactions.forEach((transaction) => {
      const classification = classifyTransaction(
        transaction.transaction_type,
        transaction.other_account_type
      );

      const amount = parseFloat(transaction.amount) || 0;

      switch (classification) {
        case 'income':
          totalIncome += amount;
          incomeTransactions++;
          break;
        case 'expense':
          totalExpenses += amount;
          expenseTransactions++;
          break;
        case 'transfer':
          transferTransactions++;
          break;
      }
    });

    return {
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
      incomeTransactions,
      expenseTransactions,
      transferTransactions
    };

  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch transaction summary');
  }
}

export async function getExpensesByCategory(
  accountCode: string,
  startDate?: string,
  endDate?: string
): Promise<Array<{
  otherAccountAlias: string;
  otherAccountCode: string;
  totalAmount: number;
  transactionCount: number;
}>> {
  try {
    const query = `
      SELECT
        CASE
          WHEN t.debitacc = ? THEN c_credit.alias
          ELSE c_debit.alias
        END as other_account_alias,
        CASE
          WHEN t.debitacc = ? THEN t.creditacc
          ELSE t.debitacc
        END as other_account_code,
        CASE
          WHEN t.debitacc = ? THEN c_credit.account_type
          ELSE c_debit.account_type
        END as other_account_type,
        CASE
          WHEN t.debitacc = ? THEN 'debit'
          ELSE 'credit'
        END as transaction_type,
        SUM(CASE WHEN t.debitacc = ? THEN t.debit ELSE t.credit END) as total_amount,
        COUNT(*) as transaction_count
      FROM rv_transaction t
      LEFT JOIN rv_cuentas c_debit ON t.debitacc = c_debit.code
      LEFT JOIN rv_cuentas c_credit ON t.creditacc = c_credit.code
      WHERE (t.debitacc = ? OR t.creditacc = ?)${startDate && endDate ? ' AND t.fecha BETWEEN ? AND ?' : ''}
      GROUP BY other_account_code, other_account_alias, other_account_type, transaction_type
      HAVING total_amount > 0
      ORDER BY total_amount DESC
    `;

    // Build parameters array in the correct order
    const queryParams = [
      accountCode,  // for other_account_alias CASE
      accountCode,  // for other_account_code CASE
      accountCode,  // for other_account_type CASE
      accountCode,  // for transaction_type CASE
      accountCode,  // for total_amount CASE
      accountCode,  // for WHERE debitacc
      accountCode   // for WHERE creditacc
    ];

    if (startDate && endDate) {
      queryParams.push(startDate, endDate);
    }

    console.log('Expenses query params:', queryParams);
    const [rows] = await pool.execute(query, queryParams);

    interface ExpenseRow {
      other_account_alias: string;
      other_account_code: string;
      other_account_type: string;
      transaction_type: string;
      total_amount: string;
      transaction_count: string;
    }

    const results = rows as ExpenseRow[];

    // Filter only expense transactions
    return results
      .filter((row) => {
        const classification = classifyTransaction(
          row.transaction_type as 'debit' | 'credit',
          row.other_account_type as 'asset' | 'liability' | 'equity' | 'income' | 'expense' | null
        );
        return classification === 'expense';
      })
      .map((row) => ({
        otherAccountAlias: row.other_account_alias || 'Unknown',
        otherAccountCode: row.other_account_code,
        totalAmount: parseFloat(row.total_amount) || 0,
        transactionCount: parseInt(row.transaction_count) || 0
      }));

  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch expenses by category');
  }
}

// Functions for handling incomplete transactions
export async function getIncompleteTransactionsByAccount(
  accountCode: string,
  limit: number = 100,
  offset: number = 0
): Promise<Transaction[]> {
  try {
    const limitInt = Math.max(1, Math.min(500, parseInt(String(limit))));
    const offsetInt = Math.max(0, parseInt(String(offset)));

    const query = `
      SELECT
        t.*,
        CASE
          WHEN t.debitacc = ? THEN 'debit'
          WHEN t.creditacc = ? THEN 'credit'
          ELSE 'unknown'
        END as transaction_type,
        CASE
          WHEN t.debitacc = ? AND t.creditacc = '0' THEN 'UNASSIGNED'
          WHEN t.creditacc = ? AND t.debitacc = '0' THEN 'UNASSIGNED'
          WHEN t.debitacc = ? THEN t.creditacc
          ELSE t.debitacc
        END as other_account_code,
        CASE
          WHEN t.debitacc = ? AND t.creditacc = '0' THEN 'Unassigned Account'
          WHEN t.creditacc = ? AND t.debitacc = '0' THEN 'Unassigned Account'
          WHEN t.debitacc = ? THEN c_credit.alias
          ELSE c_debit.alias
        END as other_account_alias,
        CASE
          WHEN t.debitacc = ? AND t.creditacc = '0' THEN NULL
          WHEN t.creditacc = ? AND t.debitacc = '0' THEN NULL
          WHEN t.debitacc = ? THEN c_credit.account_type
          ELSE c_debit.account_type
        END as other_account_type,
        CASE
          WHEN t.debitacc = '0' OR t.creditacc = '0' THEN 1
          ELSE 0
        END as is_incomplete
      FROM rv_transaction t
      LEFT JOIN rv_cuentas c_debit ON t.debitacc = c_debit.code
      LEFT JOIN rv_cuentas c_credit ON t.creditacc = c_credit.code
      WHERE (t.debitacc = ? OR t.creditacc = ?)
        AND (t.debitacc = '0' OR t.creditacc = '0')
      ORDER BY t.fecha DESC, t.id DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;

    const [rows] = await pool.execute(query, [
      accountCode, accountCode, // for transaction_type CASE
      accountCode, accountCode, accountCode, // for other_account_code CASE
      accountCode, accountCode, accountCode, // for other_account_alias CASE
      accountCode, accountCode, accountCode, // for other_account_type CASE
      accountCode, accountCode // for WHERE clause
    ]);

    const transactions = (rows as Transaction[]).map(transaction => ({
      ...transaction,
      classification: transaction.other_account_type ?
        classifyTransaction(transaction.transaction_type, transaction.other_account_type) :
        'transfer',
      is_incomplete: Boolean(transaction.is_incomplete)
    }));

    return transactions;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch incomplete transactions');
  }
}

export async function assignAccountToTransaction(
  transactionId: number,
  assignedAccountCode: string,
  isDebitAccount: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify the assigned account exists
    const [accountRows] = await pool.execute(
      'SELECT code, alias, account_type FROM rv_cuentas WHERE code = ? AND active = 1',
      [assignedAccountCode]
    );

    const accounts = accountRows as Account[];
    if (accounts.length === 0) {
      return { success: false, error: 'Assigned account not found or inactive' };
    }

    // Get the current transaction
    const [transactionRows] = await pool.execute(
      'SELECT * FROM rv_transaction WHERE id = ?',
      [transactionId]
    );

    const transactions = transactionRows as Transaction[];
    if (transactions.length === 0) {
      return { success: false, error: 'Transaction not found' };
    }

    const transaction = transactions[0];

    // Determine which field to update
    let updateQuery: string;

    if (isDebitAccount) {
      // Assign to debit account (if debitacc is '0')
      if (transaction.debitacc !== '0') {
        return { success: false, error: 'Debit account is already assigned' };
      }
      updateQuery = 'UPDATE rv_transaction SET debitacc = ? WHERE id = ?';
    } else {
      // Assign to credit account (if creditacc is '0')
      if (transaction.creditacc !== '0') {
        return { success: false, error: 'Credit account is already assigned' };
      }
      updateQuery = 'UPDATE rv_transaction SET creditacc = ? WHERE id = ?';
    }

    // Update the transaction
    await pool.execute(updateQuery, [assignedAccountCode, transactionId]);

    return { success: true };

  } catch (error) {
    console.error('Account assignment error:', error);
    return { success: false, error: 'Failed to assign account to transaction' };
  }
}

export async function getAccountsForAssignment(
  accountType?: 'income' | 'expense' | 'asset' | 'liability' | 'equity'
): Promise<Account[]> {
  try {
    let query = 'SELECT * FROM rv_cuentas WHERE active = 1';
    const params: string[] = [];

    if (accountType) {
      query += ' AND account_type = ?';
      params.push(accountType);
    }

    query += ' ORDER BY account_type, alias ASC';

    const [rows] = await pool.execute(query, params);
    return rows as Account[];
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch accounts for assignment');
  }
}

export async function getIncompleteTransactionCount(accountCode: string): Promise<number> {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM rv_transaction t
      WHERE (t.debitacc = ? OR t.creditacc = ?)
        AND (t.debitacc = '0' OR t.creditacc = '0')
    `;

    const [rows] = await pool.execute(query, [accountCode, accountCode]);
    const result = rows as { count: number }[];
    return result[0]?.count || 0;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch incomplete transaction count');
  }
}

export async function getBalanceSheetData(userId: number, dateFilter: string = '', params: (string | number)[] = []): Promise<Array<{
  id: number;
  code: string;
  alias: string;
  category: string;
  currency: string;
  total_balance: number;
  account_type: string;
}>> {
  try {
    const query = `
      SELECT
        a.id,
        a.code,
        a.alias,
        a.category,
        a.currency,
        COALESCE(SUM(
          CASE
            WHEN t.creditacc = a.code THEN COALESCE(t.credit, 0)
            WHEN t.debitacc = a.code THEN -COALESCE(t.debit, 0)
            ELSE 0
          END
        ), 0) as balance,
        COUNT(t.id) as transaction_count
      FROM rv_cuentas a
      LEFT JOIN rv_transaction t ON (t.debitacc = a.code OR t.creditacc = a.code)
        AND t.debitacc != '0' AND t.creditacc != '0'
        ${dateFilter}
      WHERE a.user = ? AND a.active = 1
      GROUP BY a.id, a.code, a.alias, a.category, a.currency
      ORDER BY a.category, a.alias
    `;

    const [rows] = await pool.execute(query, params);
    return rows as Array<{
      id: number;
      code: string;
      alias: string;
      category: string;
      currency: string;
      total_balance: number;
      account_type: string;
    }>;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch balance sheet data');
  }
}

export async function bulkUpdateAccountsCategory(
  accountIds: number[],
  category: string,
  userId: number
): Promise<{ updatedCount: number }> {
  try {
    // Create placeholders for the IN clause
    const placeholders = accountIds.map(() => '?').join(',');

    const query = `
      UPDATE rv_cuentas
      SET category = ?, date_updated = NOW()
      WHERE id IN (${placeholders}) AND user = ?
    `;

    const params = [category, ...accountIds, userId];
    const [result] = await pool.execute(query, params);

    // Get the number of affected rows
    const affectedRows = (result as { affectedRows?: number }).affectedRows || 0;

    return { updatedCount: affectedRows };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to bulk update accounts');
  }
}

export async function bulkUpdateTransactionsClassification(
  transactionIds: number[],
  classification: string,
  userId: number
): Promise<{ updatedCount: number }> {
  try {
    // Create placeholders for the IN clause
    const placeholders = transactionIds.map(() => '?').join(',');

    // First, verify that all transactions belong to the user
    // We need to check through the account ownership
    const verifyQuery = `
      SELECT COUNT(*) as count
      FROM rv_transaction t
      JOIN rv_cuentas a ON (t.debitacc = a.code OR t.creditacc = a.code)
      WHERE t.id IN (${placeholders}) AND a.user = ?
    `;

    const [verifyResult] = await pool.execute(verifyQuery, [...transactionIds, userId]);
    const verifyCount = (verifyResult as Array<{ count: number }>)[0].count;

    if (verifyCount === 0) {
      throw new Error('No transactions found or access denied');
    }

    // Update the transactions
    const updateQuery = `
      UPDATE rv_transaction t
      SET t.classification = ?
      WHERE t.id IN (${placeholders})
      AND EXISTS (
        SELECT 1 FROM rv_cuentas a
        WHERE (t.debitacc = a.code OR t.creditacc = a.code)
        AND a.user = ?
      )
    `;

    const params = [classification, ...transactionIds, userId];
    const [result] = await pool.execute(updateQuery, params);

    // Get the number of affected rows
    const affectedRows = (result as { affectedRows?: number }).affectedRows || 0;

    return { updatedCount: affectedRows };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to bulk update transactions');
  }
}

export async function bulkAssignAccountToTransactions(
  transactionIds: number[],
  assignedAccountCode: string,
  isDebitAccount: boolean,
  userId: number
): Promise<{ updatedCount: number }> {
  try {
    // Create placeholders for the IN clause
    const placeholders = transactionIds.map(() => '?').join(',');

    // First, verify that all transactions belong to the user and the assigned account exists
    const verifyQuery = `
      SELECT
        (SELECT COUNT(*) FROM rv_transaction t
         JOIN rv_cuentas a ON (t.debitacc = a.code OR t.creditacc = a.code)
         WHERE t.id IN (${placeholders}) AND a.user = ?) as transaction_count,
        (SELECT COUNT(*) FROM rv_cuentas WHERE code = ? AND user = ? AND active = 1) as account_count
    `;

    const [verifyResult] = await pool.execute(verifyQuery, [...transactionIds, userId, assignedAccountCode, userId]);
    const { transaction_count, account_count } = (verifyResult as Array<{ transaction_count: number; account_count: number }>)[0];

    if (transaction_count === 0) {
      throw new Error('No transactions found or access denied');
    }

    if (account_count === 0) {
      throw new Error('Assigned account not found or access denied');
    }

    // Update the transactions - assign to debit or credit field
    const updateField = isDebitAccount ? 'debitacc' : 'creditacc';
    const updateQuery = `
      UPDATE rv_transaction t
      SET t.${updateField} = ?
      WHERE t.id IN (${placeholders})
      AND EXISTS (
        SELECT 1 FROM rv_cuentas a
        WHERE (t.debitacc = a.code OR t.creditacc = a.code)
        AND a.user = ?
      )
    `;

    const params = [assignedAccountCode, ...transactionIds, userId];
    const [result] = await pool.execute(updateQuery, params);

    // Get the number of affected rows
    const affectedRows = (result as { affectedRows?: number }).affectedRows || 0;

    return { updatedCount: affectedRows };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to bulk assign accounts to transactions');
  }
}

export async function bulkDeleteTransactions(
  transactionIds: number[],
  userId: number
): Promise<{ deletedCount: number }> {
  try {
    // Create placeholders for the IN clause
    const placeholders = transactionIds.map(() => '?').join(',');

    // Delete transactions - only if user has access to the accounts involved
    const deleteQuery = `
      DELETE t FROM rv_transaction t
      WHERE t.id IN (${placeholders})
      AND EXISTS (
        SELECT 1 FROM rv_cuentas a
        WHERE (t.debitacc = a.code OR t.creditacc = a.code)
        AND a.user = ?
      )
    `;

    const params = [...transactionIds, userId];
    const [result] = await pool.execute(deleteQuery, params);

    // Get the number of affected rows
    const affectedRows = (result as { affectedRows?: number }).affectedRows || 0;

    return { deletedCount: affectedRows };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to bulk delete transactions');
  }
}

export interface PLAccount {
  code: string;
  alias: string;
  category: string;
  account_type: string;
  total_balance: number;
  currency: string;
}

export interface PLData {
  income_accounts: PLAccount[];
  expense_accounts: PLAccount[];
  total_income: number;
  total_expenses: number;
  net_profit: number;
  period_start: string;
  period_end: string;
}

export async function getProfitLossData(
  startDate: string,
  endDate: string,
  userId: number,
  entityId?: number,
  currency?: string
): Promise<PLData> {
  try {
    // Build dynamic WHERE conditions and parameters
    const whereConditions = ['a.user = ?', 'a.active = 1', 'a.account_type IN (\'income\', \'expense\')'];
    const queryParams: (string | number)[] = [startDate, endDate];

    // Add entity filter if specified
    let entityJoin = '';
    if (entityId) {
      entityJoin = 'LEFT JOIN company comp ON t.company = comp.id';
      whereConditions.push('t.company = ?');
      queryParams.push(entityId);
    }

    // Add currency filter if specified
    if (currency) {
      whereConditions.push('a.currency = ?');
      queryParams.push(currency);
    }

    queryParams.push(userId);

    // Query to calculate account balances from transactions within the date range
    // For income accounts: credit increases balance, debit decreases balance
    // For expense accounts: debit increases balance, credit decreases balance
    const query = `
      SELECT
        a.code,
        a.alias,
        a.category,
        a.account_type,
        a.currency,
        CASE
          WHEN a.account_type = 'income' THEN
            COALESCE(SUM(CASE WHEN t.creditacc = a.code THEN t.credit ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN t.debitacc = a.code THEN t.debit ELSE 0 END), 0)
          WHEN a.account_type = 'expense' THEN
            COALESCE(SUM(CASE WHEN t.debitacc = a.code THEN t.debit ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN t.creditacc = a.code THEN t.credit ELSE 0 END), 0)
          ELSE 0
        END as total_balance
      FROM rv_cuentas a
      LEFT JOIN rv_transaction t ON (
        (t.debitacc = a.code OR t.creditacc = a.code)
        AND t.fecha BETWEEN ? AND ?
      )
      ${entityJoin}
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY a.id, a.code, a.alias, a.category, a.account_type, a.currency
      HAVING total_balance != 0
      ORDER BY a.account_type, a.alias ASC
    `;

    const [rows] = await pool.execute(query, queryParams);
    const accounts = rows as PLAccount[];

    // Separate income and expense accounts
    const income_accounts = accounts.filter(acc => acc.account_type === 'income');
    const expense_accounts = accounts.filter(acc => acc.account_type === 'expense');

    // Calculate totals
    const total_income = income_accounts.reduce((sum, acc) => sum + Number(acc.total_balance), 0);
    const total_expenses = expense_accounts.reduce((sum, acc) => sum + Number(acc.total_balance), 0);
    const net_profit = total_income - total_expenses;

    return {
      income_accounts,
      expense_accounts,
      total_income,
      total_expenses,
      net_profit,
      period_start: startDate,
      period_end: endDate
    };

  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch profit & loss data');
  }
}

export interface Entity {
  [key: string]: unknown;
  id: number;
  code: string;
  sub_code: string | null;
  name: string | null;
  companyEmail: string | null;
  email: number;
  whatsapp: number;
  timezone: string | null;
  vat: number;
  organization_id: number | null;
  user_id: number | null;
  total_accounts?: number;
  total_balance?: number;
  incomplete_transactions_count?: number;
}

export async function getEntitiesByUserId(userId: number): Promise<Entity[]> {
  try {
    const query = `
      SELECT
        c.*,
        COUNT(DISTINCT a.id) as total_accounts,
        COALESCE(SUM(a.balance), 0) as total_balance,
        COUNT(DISTINCT CASE
          WHEN t.debitacc = '0' OR t.creditacc = '0'
          THEN t.id
          ELSE NULL
        END) as incomplete_transactions_count
      FROM company c
      LEFT JOIN rv_cuentas a ON c.id = a.company AND a.active = 1
      LEFT JOIN rv_transaction t ON (t.debitacc = a.code OR t.creditacc = a.code)
      WHERE c.user_id = ?
      GROUP BY c.id, c.code, c.sub_code, c.name, c.companyEmail, c.email, c.whatsapp, c.timezone, c.vat, c.organization_id, c.user_id
      ORDER BY c.name ASC
    `;

    const [rows] = await pool.execute(query, [userId]);
    return rows as Entity[];
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch entities');
  }
}

export async function getEntityById(entityId: number, userId: number): Promise<Entity | null> {
  try {
    const query = `
      SELECT
        c.*,
        COUNT(DISTINCT a.id) as total_accounts,
        COALESCE(SUM(a.balance), 0) as total_balance,
        COUNT(DISTINCT CASE
          WHEN t.debitacc = '0' OR t.creditacc = '0'
          THEN t.id
          ELSE NULL
        END) as incomplete_transactions_count
      FROM company c
      LEFT JOIN rv_cuentas a ON c.id = a.company AND a.active = 1
      LEFT JOIN rv_transaction t ON (t.debitacc = a.code OR t.creditacc = a.code)
      WHERE c.id = ? AND c.user_id = ?
      GROUP BY c.id, c.code, c.sub_code, c.name, c.companyEmail, c.email, c.whatsapp, c.timezone, c.vat, c.organization_id, c.user_id
    `;

    const [rows] = await pool.execute(query, [entityId, userId]);
    const entities = rows as Entity[];
    return entities.length > 0 ? entities[0] : null;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch entity');
  }
}

export async function createEntity(entityData: {
  code: string;
  sub_code?: string;
  name: string;
  companyEmail?: string;
  email?: number;
  whatsapp?: number;
  timezone?: string;
  vat?: number;
  organization_id?: number;
  userId: number;
}): Promise<Entity> {
  try {
    const {
      code,
      sub_code,
      name,
      companyEmail,
      email = 0,
      whatsapp = 0,
      timezone,
      vat = 0,
      organization_id,
      userId
    } = entityData;

    const insertQuery = `
      INSERT INTO company (code, sub_code, name, companyEmail, email, whatsapp, timezone, vat, organization_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(insertQuery, [
      code, sub_code, name, companyEmail, email, whatsapp, timezone, vat, organization_id, userId
    ]);

    const insertId = (result as { insertId: number }).insertId;

    // Return the created entity
    const entity = await getEntityById(insertId, userId);
    if (!entity) {
      throw new Error('Failed to retrieve created entity');
    }

    return entity;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to create entity');
  }
}

export default pool;