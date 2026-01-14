const http = require('http');
const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, 'users.txt');
const classesFilePath = path.join(__dirname, 'classes.json');
const equipmentFilePath = path.join(__dirname, 'equipment.json');

console.log('=================================');
console.log('🚀 SERVER STARTING...');
console.log('📂 Serving files from:', __dirname);
console.log('=================================');

if (!fs.existsSync(usersFilePath)) {
    const header = 'ID    | NAME            | EMAIL                     | PASSWORD             | GOAL                 | DATE & TIME           | IP ADDRESS      | ROLE\n' +
        '-----------------------------------------------------------------------------------------------------------------------------------------------------------\n';
    fs.writeFileSync(usersFilePath, header, 'utf8');
}
if (!fs.existsSync(classesFilePath)) fs.writeFileSync(classesFilePath, '[]', 'utf8');
if (!fs.existsSync(equipmentFilePath)) fs.writeFileSync(equipmentFilePath, '[]', 'utf8');

function padRight(str, len) {
    str = String(str || '');
    return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'Unknown';
}

function getFormattedDateTime() {
    const now = new Date();
    return `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
}

function parseUsersFromFile() {
    const data = fs.readFileSync(usersFilePath, 'utf8');
    const lines = data.trim().split('\n');
    const users = [];
    for (let line of lines) {
        if (line.includes('|') && !line.includes('ID') && !line.includes('---')) {
            const cols = line.split('|').map(c => c.trim());
            if (cols.length > 1) {
                users.push({
                    id: cols[0],
                    name: cols[1],
                    email: cols[2],
                    password: cols[3],
                    goal: cols[4],
                    role: cols[7] || 'Member'
                });
            }
        }
    }
    return users;
}
const mimeTypes = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { email, password } = JSON.parse(body);
                const users = parseUsersFromFile();
                const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

                if (found) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(found));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Email or Password Incorrect' }));
                }
            } catch (e) { res.writeHead(500); res.end('Server Error'); }
        });
        return;
    }

    if (req.url === '/register' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const u = JSON.parse(body);
                const users = parseUsersFromFile();
                if (users.find(user => user.email.toLowerCase() === u.email.toLowerCase())) {
                    res.writeHead(409); return res.end('email duplicate');
                }

                const newId = users.length > 0 ? Math.max(...users.map(x => parseInt(x.id))) + 1 : 1;
                const newLine = `\n${padRight(newId, 6)}| ${padRight(u.name, 16)}| ${padRight(u.email, 26)}| ${padRight(u.password, 21)}| ${padRight(u.goal || 'General', 21)}| ${padRight(getFormattedDateTime(), 22)}| ${padRight(getClientIP(req), 16)}| Member`;
                
                fs.appendFileSync(usersFilePath, newLine, 'utf8');
                res.writeHead(200); res.end('Registered');
            } catch (e) { res.writeHead(500); res.end('Error'); }
        });
        return;
    }

    if (req.url === '/users' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(parseUsersFromFile()));
        return;
    }

    if (req.url === '/update-role' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { id, newRole } = JSON.parse(body);
            let data = fs.readFileSync(usersFilePath, 'utf8');
            let lines = data.split('\n');
            let updatedLines = lines.map(line => {
                if (line.includes('|') && line.trim().startsWith(String(id))) {
                    const cols = line.split('|').map(c => c.trim());
                    return `${padRight(cols[0], 6)}| ${padRight(cols[1], 16)}| ${padRight(cols[2], 26)}| ${padRight(cols[3], 21)}| ${padRight(cols[4], 21)}| ${padRight(cols[5], 22)}| ${padRight(cols[6], 16)}| ${newRole}`;
                }
                return line;
            });
            fs.writeFileSync(usersFilePath, updatedLines.join('\n'), 'utf8');
            res.writeHead(200); res.end('Updated');
        });
        return;
    }

    if (req.url.startsWith('/classes') || req.url.startsWith('/equipment')) {
        const isClass = req.url.startsWith('/classes');
        const filePath = isClass ? classesFilePath : equipmentFilePath;
        
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fs.readFileSync(filePath));
        } else if (req.method === 'POST') {
            let body = ''; req.on('data', c => body += c);
            req.on('end', () => {
                const list = JSON.parse(fs.readFileSync(filePath));
                const item = JSON.parse(body);
                item.id = Date.now();
                list.push(item);
                fs.writeFileSync(filePath, JSON.stringify(list));
                res.writeHead(200); res.end('Saved');
            });
        }
        return;
    }

    let requestedPath = '.' + req.url;
    if (requestedPath === './') {
        requestedPath = './index.htm';
    }
    const extname = String(path.extname(requestedPath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    fs.readFile(requestedPath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`<h1>404 Not Found</h1><p>File not found: ${requestedPath}</p>`, 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n✅ SERVER IS RUNNING!`);
    console.log(`👉 Open this link: http://localhost:${PORT}`);
    console.log(`   (This will load index.htm automatically)\n`);
});