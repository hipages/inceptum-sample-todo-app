CREATE DATABASE todo;

CREATE TABLE todo.table1 (`id` int(11) NOT NULL AUTO_INCREMENT, `name` varchar(20) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=UTF8;

INSERT INTO todo.table1 (name) VALUES ("User 1"),("User 2"),("User 3");
