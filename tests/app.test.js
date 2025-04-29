import request from 'supertest';
import { app, server } from '../server.js'; // Assuming the main file is named index.js
import jwt from 'jsonwebtoken';
import connectMySQL from '../connectMySQL.js';
import path from 'path';
import fs from 'fs';

// Mock dependencies
jest.mock('../connectMySQL.js');
jest.mock('jsonwebtoken');
jest.mock('fs');

describe('API Endpoints', () => {
  let mockConnection;
  let mockExecute;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock connection and execute
    mockExecute = jest.fn();
    mockConnection = {
      execute: mockExecute,
      end: jest.fn().mockResolvedValue(true)
    };
    connectMySQL.mockResolvedValue(mockConnection);
  });

  afterAll(() => {
    // Close the server after all tests
    server.close();
  });

  describe('GET /', () => {
    it('should return greeting message for localhost', async () => {
      const res = await request(app)
        .get('/')
        .set('Host', 'localhost:3000');
      
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('Hello, Backend!, from localhost');
    });

    it('should return custom greeting for non-localhost origins', async () => {
      const res = await request(app)
        .get('/')
        .set('Host', 'example.com');
      
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('Hello, Bolo!, from example.com');
    });
  });

  describe('GET /connect/mysql', () => {
    it('should return success message when database is connected', async () => {
      const res = await request(app).get('/connect/mysql');
      
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('database is connected');
      expect(connectMySQL).toHaveBeenCalled();
      expect(mockConnection.end).toHaveBeenCalled();
    });

    it('should return failure message when database is not connected', async () => {
      connectMySQL.mockResolvedValueOnce(null);
      
      const res = await request(app).get('/connect/mysql');
      
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('database is not connected');
      expect(connectMySQL).toHaveBeenCalled();
    });
  });

  describe('Basic route tests', () => {
    it('GET /tambah should return correct sum', async () => {
      const res = await request(app).get('/tambah');
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('Hasil: 30');
    });

    it('GET /bagi/:a/:b should return correct division result', async () => {
      const res = await request(app).get('/bagi/10/2');
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('Hasil: 5');
    });

    it('GET /bagi/:a/:b should handle division by zero', async () => {
      const res = await request(app).get('/bagi/10/0');
      expect(res.statusCode).toBe(400);
      expect(res.text).toBe('Tidak bisa membagi dengan nol.');
    });

    it('GET /bagi/:a/:b should validate numeric parameters', async () => {
      const res = await request(app).get('/bagi/abc/2');
      expect(res.statusCode).toBe(400);
      expect(res.text).toBe('Parameter harus berupa angka.');
    });
  });

  describe('Authentication', () => {
    describe('POST /login', () => {
      it('should return 400 if email or password is missing', async () => {
        const res = await request(app)
          .post('/login')
          .send({ email: 'test@example.com' });
        
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('ID and role are required');
      });

      it('should return 200 and JWT token on successful login', async () => {
        const mockUser = { 
          id: 1, 
          email: 'test@example.com', 
          password: 'password123', 
          role: 'admin' 
        };
        
        mockExecute.mockResolvedValueOnce([[mockUser]]);
        jwt.sign.mockReturnValueOnce('fake-token');

        const res = await request(app)
          .post('/login')
          .send({ email: 'test@example.com', password: 'password123' });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Login successful');
        expect(res.body.token).toBe('fake-token');
        expect(jwt.sign).toHaveBeenCalledWith(
          { id: mockUser.id, role: mockUser.role },
          'secret',
          { expiresIn: '1h' }
        );
      });

      it('should return 401 if credentials are invalid', async () => {
        const mockUser = { 
          id: 1, 
          email: 'test@example.com', 
          password: 'correctpassword', 
          role: 'admin' 
        };
        
        mockExecute.mockResolvedValueOnce([[mockUser]]);

        const res = await request(app)
          .post('/login')
          .send({ email: 'test@example.com', password: 'wrongpassword' });
        
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Invalid email or password');
      });

      it('should return 500 if database query fails', async () => {
        mockExecute.mockRejectedValueOnce(new Error('Database error'));

        const res = await request(app)
          .post('/login')
          .send({ email: 'test@example.com', password: 'password123' });
        
        expect(res.statusCode).toBe(500);
        expect(res.body.message).toBe('Internal server error');
      });
    });

    describe('Authentication middleware', () => {
      it('should grant access to authorized users', async () => {
        jwt.verify.mockReturnValueOnce({ id: 1, role: 'Admin' });

        const res = await request(app)
          .get('/grant-access')
          .set('Authorization', 'Bearer fake-token');
        
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Access granted');
        expect(jwt.verify).toHaveBeenCalledWith('fake-token', 'secret');
      });

      it('should reject users with invalid tokens', async () => {
        jwt.verify.mockImplementationOnce(() => {
          throw new Error('Invalid token');
        });

        const res = await request(app)
          .get('/grant-access')
          .set('Authorization', 'Bearer invalid-token');
        
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe('Invalid token');
      });
    });
  });

  describe('User management', () => {
    beforeEach(() => {
      jwt.verify.mockReturnValue({ id: 1, role: 'admin' });
    });

    describe('GET /users', () => {
      it('should return all users for admin', async () => {
        const mockUsers = [
          { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin', avatar: 'avatar1.jpg' },
          { id: 2, name: 'User', email: 'user@example.com', role: 'user', avatar: '' }
        ];
        
        mockExecute.mockResolvedValueOnce([mockUsers]);

        const res = await request(app)
          .get('/users')
          .set('Authorization', 'Bearer fake-token');
        
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(expect.arrayContaining([
          expect.objectContaining({ 
            id: 1, 
            name: 'Admin', 
            avatar: expect.stringContaining('/file/avatar1.jpg') 
          }),
          expect.objectContaining({ 
            id: 2, 
            name: 'User', 
            avatar: '' 
          })
        ]));
      });

      it('should return only the user data for non-admin users', async () => {
        jwt.verify.mockReturnValueOnce({ id: 2, role: 'user' });
        
        const mockUser = { id: 2, name: 'User', email: 'user@example.com', role: 'user', avatar: '' };
        mockExecute.mockResolvedValueOnce([[mockUser]]);

        const res = await request(app)
          .get('/users')
          .set('Authorization', 'Bearer fake-token');
        
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(expect.objectContaining({
          id: 2,
          name: 'User',
          email: 'user@example.com'
        }));
      });

      it('should handle database errors', async () => {
        mockExecute.mockRejectedValueOnce(new Error('Database error'));

        const res = await request(app)
          .get('/users')
          .set('Authorization', 'Bearer fake-token');
        
        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Internal Server Error');
      });
    });

    describe('POST /users', () => {
      it('should create a new user', async () => {
        const newUser = {
          name: 'New User',
          email: 'new@example.com',
          password: 'password123',
          role: 'user'
        };
        
        mockExecute.mockResolvedValueOnce([[]]); // No existing user with this email
        mockExecute.mockResolvedValueOnce([]); // Insert success
        mockExecute.mockResolvedValueOnce([[newUser, { id: 3 }]]); // Return users after insert

        const res = await request(app)
          .post('/users')
          .set('Authorization', 'Bearer fake-token')
          .send(newUser);
        
        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(mockExecute).toHaveBeenCalled();
      });

      it('should return 400 if required fields are missing', async () => {
        const incompleteUser = {
          name: 'Incomplete User',
          email: 'incomplete@example.com'
        };

        const res = await request(app)
          .post('/users')
          .set('Authorization', 'Bearer fake-token')
          .send(incompleteUser);
        
        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Bad Request');
      });

      it('should return 400 if email already exists', async () => {
        const existingUser = {
          name: 'Existing User',
          email: 'existing@example.com',
          password: 'password123',
          role: 'user'
        };
        
        mockExecute.mockResolvedValueOnce([[existingUser]]); // Email already exists

        const res = await request(app)
          .post('/users')
          .set('Authorization', 'Bearer fake-token')
          .send(existingUser);
        
        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Email already exists');
      });
    });

    describe('PUT /users/:id', () => {
      it('should return 404 if user not found', async () => {
        const updatedUser = {
          name: 'Updated User',
          email: 'existing@example.com',
          password: 'newpassword',
          role: 'user'
        };
        
        mockExecute.mockResolvedValueOnce([]); // User not found
        mockExecute.mockResolvedValueOnce([[]]); // No email conflict
        const res = await request(app)
          .put('/users/999')
          .set('Authorization', 'Bearer fake-token')
          .send(updatedUser);
        
        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('User not found');
      })

      it('should update user data', async () => {
        const updatedUser = {
          name: 'Updated User',
          email: 'updated@example.com',
          password: 'newpassword',
          role: 'admin',
        };
        
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists
        mockExecute.mockResolvedValueOnce([[]]); // No email conflict
        mockExecute.mockResolvedValueOnce([[]]); // Update success
        mockExecute.mockResolvedValueOnce([updatedUser]); // Return updated users

        const res = await request(app)
          .put('/users/2')
          .set('Authorization', 'Bearer fake-token')
          .send(updatedUser);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockExecute).toHaveBeenCalled();
      });

      it('should return 400 if email already exists', async () => {
        const updatedUser = {
          name: 'Updated User',
          email: 'existing@example.com',
          password: 'newpassword',
          role: 'user'
        };
        
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists
        mockExecute.mockResolvedValueOnce([[{ id: 3 }]]); // Email conflict

        const res = await request(app)
          .put('/users/2')
          .set('Authorization', 'Bearer fake-token')
          .send(updatedUser);
        
        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Email already exists');
      });
    });

    describe('DELETE /users/:id', () => {
      it('should delete a user', async () => {
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists
        mockExecute.mockResolvedValueOnce([]); // Delete success
        mockExecute.mockResolvedValueOnce([{ id: 1 }]); // Return remaining users

        const res = await request(app)
          .delete('/users/2')
          .set('Authorization', 'Bearer fake-token');
        
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockExecute).toHaveBeenCalledWith('DELETE FROM users WHERE id = ?', [2]);
      });

      it('should return 404 if user does not exist', async () => {
        mockExecute.mockResolvedValueOnce([]);

        const res = await request(app)
          .delete('/users/999')
          .set('Authorization', 'Bearer fake-token');
        
        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('User not found');
      });
    });
  });

  describe('Task management', () => {
    describe('GET /tasks', () => {
      it('should return tasks for authorized user', async () => {
        const mockTasks = [
          { id: 1, user_id: 2, tittle: 'Task 1', description: 'Description 1', is_done: false },
          { id: 2, user_id: 2, tittle: 'Task 2', description: 'Description 2', is_done: true }
        ];
        
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists
        mockExecute.mockResolvedValueOnce([mockTasks]);

        const res = await request(app)
          .get('/tasks')
          .set('user_id', '2');
        
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(mockTasks);
      });

      it('should return 401 if user_id header is missing', async () => {
        const res = await request(app).get('/tasks');
        
        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Unauthorized');
      });
    });

    describe('POST /tasks', () => {
      it('should create a new task', async () => {
        const newTask = {
          tittle: 'New Task',
          description: 'New Description'
        };
        
        const mockTasks = [
          { id: 1, user_id: 2, tittle: 'Task 1', description: 'Description 1', is_done: false },
          { id: 2, user_id: 2, tittle: 'New Task', description: 'New Description', is_done: false }
        ];
        
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists
        mockExecute.mockResolvedValueOnce([]); // Insert success
        mockExecute.mockResolvedValueOnce([mockTasks]); // Return tasks after insert

        const res = await request(app)
          .post('/tasks')
          .set('user_id', '2')
          .send(newTask);
        
        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(mockTasks);
      });

      it('should return 400 if required fields are missing', async () => {
        const incompleteTask = {
          tittle: 'Incomplete Task'
        };
        
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists

        const res = await request(app)
          .post('/tasks')
          .set('user_id', '2')
          .send(incompleteTask);
        
        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Bad Request');
      });
    });

    describe('PUT /tasks/:id', () => {
      it('should update task data', async () => {
        const updatedTask = {
          tittle: 'Updated Task',
          description: 'Updated Description'
        };
        
        const mockTask = { 
          id: 1,
          user_id: 2,
          tittle: 'Task 1', 
          description: 'Description 1', 
          is_done: false 
        };
        const mockUpdatedTasks = { 
          id: 1, 
          user_id: 2, 
          tittle: 'Updated Task', 
          description: 'Updated Description', 
          is_done: false 
        };
        
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists
        mockExecute.mockResolvedValueOnce([[mockTask]]); // Task exists
        mockExecute.mockResolvedValueOnce([[]]); // Update success
        mockExecute.mockResolvedValueOnce([mockUpdatedTasks]); // Return updated tasks

        const res = await request(app)
          .put('/tasks/1')
          .set('user_id', '2')
          .send(updatedTask);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(mockUpdatedTasks);
      });

      it('should return 404 if task does not exist', async () => {
        const updatedTask = {
          tittle: 'Updated Task',
          description: 'Updated Description'
        };
        
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists
        mockExecute.mockResolvedValueOnce([[]]);

        const res = await request(app)
          .put('/tasks/999')
          .set('user_id', '2')
          .send(updatedTask);
        
        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Task Not Found');
      });
    });

    describe('DELETE /tasks/:id', () => {
      it('should delete a task', async () => {
        const mockTask = [{ id: 1, user_id: 2, tittle: 'Task 1', description: 'Description 1', is_done: false }];
        
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists
        mockExecute.mockResolvedValueOnce(mockTask); // Task exists
        mockExecute.mockResolvedValueOnce([]); // Delete success
        mockExecute.mockResolvedValueOnce([]); // Return remaining tasks

        const res = await request(app)
          .delete('/tasks/1')
          .set('user_id', '2');
        
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(undefined);
      });

      it('should return 404 if task does not exist', async () => {
        mockExecute.mockResolvedValueOnce([{ id: 2 }]); // User exists
        mockExecute.mockResolvedValueOnce([]);

        const res = await request(app)
          .delete('/tasks/999')
          .set('user_id', '2');
        
        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Task Not Found');
      });
    });
  });

  describe('File upload', () => {
    it('should return 400 if no file is uploaded', async () => {
      const res = await request(app)
        .post('/upload');
      
      expect(res.statusCode).toBe(400);
      expect(res.text).toBe('No file uploaded');
    });

    it('should return 404 if file does not exist', async () => {
      fs.existsSync.mockReturnValueOnce(false);

      const res = await request(app)
        .get('/file/nonexistent.jpg');
      
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('File not found');
    });
  });

  describe('Encryption service', () => {
    it('should encrypt data', async () => {
      const res = await request(app)
        .post('/secure-data')
        .send({ data: 'sensitive information' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Data encrypted successfully');
      expect(res.body.encrypted).toBeDefined();
      expect(typeof res.body.encrypted).toBe('string');
    });
  });
});