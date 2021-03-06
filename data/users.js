// some fuinctions for user collection
const mongoCollections = require('../config/mongoCollections');
const taskModule = require('./tasks');
const users = mongoCollections.users;
const bcrypt = require('bcrypt');
const verify = require('../inputVerification');

// returns mongodb-approved ObjectId
const createObjectId = (id) => {
  let { ObjectId } = require('mongodb');
  verify.standard.verifyArg(id, 'id', 'users/createObjectId', 'objectId');

  let parsedId = ObjectId(id);
  return parsedId;
};

module.exports = {
  // returns all users in js array
  /**
   * outputs all users in the collection
   * @returns array containing all users in collection
   */
  async getAllUsers(arg) {
    verify.standard.argDNE(arg, 'getAllUsers');
    const userCollection = await users();

    const userData = await userCollection.find({}).toArray();
    let result = [];
    for (let i = 0; i < userData.length; i++) {
      result.push({
        _id: userData[i]._id.toString(),
        name: userData[i].name,
      });
    }

    return result;
  },

  // returns one specific user given valid id
  /**
   * returns one user given their id
   * @param {string} id valid ObjectId of user to return
   * @returns user with provided ObjectId
   */
  async getUserById(id) {
    verify.standard.verifyArg(id, 'id', 'getUserById', 'objectId');

    const userCollection = await users();
    id = createObjectId(id);
    const user = await userCollection.findOne({ _id: id });
    if (user) {
      user._id = user._id.toString();
    }
    return user;
  },
  /**
   * creates a new user, adding them to the collection
   * @param {string} fname user's first name
   * @param {string} lname user's last name
   * @param {string} username user's username
   * @param {string} hashedPassword user's hashed password
   * @param {string} companyEmail user's unique companyEmail
   * @returns userObj after inserted into collection
   */
  async addUser(fname, lname, username, hashedPassword, companyEmail) {
    verify.standard.verifyArg(fname, 'fname', 'addUser', 'string');
    verify.standard.verifyArg(lname, 'lname', 'addUser', 'string');
    verify.standard.verifyArg(username, 'username', 'addUser', 'string');
    verify.standard.verifyArg(hashedPassword, 'hashedPassword', 'addUser', 'string');
    verify.standard.verifyArg(companyEmail, 'companyEmail', 'addUser', 'string');

    const userCollection = await users();

    const emailChecker = new RegExp(`^${companyEmail}$`, 'i');
    const userChecker = new RegExp(`^${username}$`, 'i');

    const checkEmail = await userCollection.findOne({
      companyEmail: emailChecker,
    });
    if (checkEmail) {
      throw `Email ${companyEmail} is already registered to an account`;
    }

    const checkUsername = await userCollection.findOne({
      username: userChecker,
    });
    if (checkUsername) {
      throw `Username ${username} is already taken`;
    }

    // fields to be added to the user
    // but not supplied as arguments to the function
    let activeTasks = [],
      completedTasks = [],
      level = 1,
      currXP = 0;

    // the user obj to be added to the collection
    const newUser = {
      firstName: fname,
      lastName: lname,
      username: username,
      hashedPassword: hashedPassword,
      companyEmail: companyEmail,
      level: level,
      currXP: currXP,
      activeTasks: activeTasks,
      completedtasks: completedTasks,
    };

    const newInsertUser = await userCollection.insertOne(newUser);
    if (newInsertUser.insertedCount === 0) throw 'Could not add user';

    const newId = newInsertUser.insertedId;
    const user = await this.getUserById(newId.toString());
    return user;
  },
  /**
   * Adds a task to the completed field of user, awarding xp appropiately
   * @param {string} userId user to add the task to
   * @param {string} taskId task to add to the user
   * @returns updated user object
   */
  async markTaskCompleted(userId, taskId) {
    // verify.standard.verifyArg(userId, 'userId', 'markTaskCompleted', 'objectId');
    // verify.standard.verifyArg(taskId, 'taskId', 'markTaskCompleted', 'objectId');
    const userCollection = await users();
    const user_to_update = await this.getUserById(userId);
    const task_to_add = await taskModule.getTaskById(taskId);

    user_to_update.completedtasks.push(task_to_add);
    // const newLevel = user_to_update.level + this.incrementLevel(userId);
    // const newCurrXP = user_to_update.currXP + this.awardExp(task_to_add.level, userId);
    const expUser = await this.awardExp(task_to_add.points, userId);
    const levelUser = await this.incrementLevel(expUser._id.toString());
    const newTasks = user_to_update.activeTasks.filter((e) => {
      return e._id !== taskId;
    });
    const updatedUser = {
      fname: user_to_update.fname,
      lname: user_to_update.lname,
      companyEmail: user_to_update.companyEmail,
      activeTasks: newTasks,
      completedtasks: user_to_update.completedtasks,
      level: levelUser.level,
      currXP: levelUser.currXP,
    };

    const updatedInfo = await userCollection.updateOne(
      { _id: createObjectId(userId) },
      { $set: updatedUser },
    );
    if (updatedInfo.modifiedCount === 0) {
      throw `Could not update user with id ${userId}`;
    }

    let retVal = await this.getUserById(userId);
    retVal._id = retVal._id.toString();
    return retVal;
  },
  /**
   * awardExp awards experience to the user based on the level of the task.
   * Level 1 task = 25 points.
   * Level 2 task = 50 points.
   * Level 3 task = 100 points.
   * @param {Number} exp Number greater than 0 that is a multiple of 25.
   * @param {String} userID String of the ID of the user in the database.
   */
  async awardExp(exp, userID) {
    // Error checking
    const id = createObjectId(userID);
    if (!exp || typeof exp !== 'number' || exp < 0) throw 'Error: Invalid Experience Count';

    verify.standard.verifyArg(userID, 'userID', 'awardExp', 'objectId');

    const userCollection = await users();

    // Increment current experience by the experience given by the taskLevel
    const user = await userCollection.updateOne({ _id: id }, { $inc: { currXP: exp } });

    if (user.modifiedCount === 0) throw 'Could not update user experience.';

    const newUser = await this.getUserById(userID);
    return newUser;
  },
  /**
 * Levels up user based on this
 * Levels        Exp needed for next tier
 * 	1                     50
    2	                  75
    3	                  100
    4	                  150
    5	                  200
  After 5           level*100-300
 * @param {String} userID String of the ID of the user in the database.
 * @returns 0 
 */
  async incrementLevel(userID) {
    verify.standard.verifyArg(userID, 'userID', 'incrementLevel', 'objectId');

    const userCollection = await users(); // pulling stuff from database
    const id = createObjectId(userID);
    let stopleveling = true;
    let finalUserObject;

    while (stopleveling) {
      //while stopleveling is true loop
      let user = await this.getUserById(userID);
      let levelz = user.level;
      let newExp = user.currXP;
      let neededExp;
      //checks how much exp is needed for next level
      if (levelz < 6) {
        if (levelz === 1) {
          neededExp = 50;
        } else if (levelz == 2) {
          neededExp = 75;
        } else if (levelz === 3) {
          neededExp = 100;
        } else if (levelz === 4) {
          neededExp = 150;
        } else {
          neededExp = 200;
        }
      } else {
        neededExp = levelz * 100 - 300;
      }
      //checks if exp is enough to level up
      if (newExp >= neededExp) {
        newExp = newExp - neededExp;
        const user = userCollection.updateOne(
          { _id: id },
          { $set: { level: levelz + 1, currXP: newExp } }, //updates all values
        );
        if (user.modifiedCount === 0) throw 'Could not update user experience.'; //error checking
      } else {
        stopleveling = false; //stops loop if not enough exp
        finalUserObject = user;
      }
    }
    return finalUserObject; //placeholder
  },
  /**
   * compares username/password to users in DB
   * @param {string} username plaintext username
   * @param {string} password plaintext password
   * @returns the user's DB entry upon success
   */
  async validateUser(username, password) {
    //begin validation
    verify.standard.verifyArg(username, 'username', 'validateUser', 'string');
    verify.standard.verifyArg(password, 'password', 'validateUser', 'string');
    //end validation

    const userCollection = await users();
    let attemptedUser = await userCollection.findOne({
      username: username,
    });

    // we manually set this field  when the username is not found
    // so that we throw an error only once, so that it cannot
    // be determined if the username was valid
    if (attemptedUser === undefined) {
      attemptedUser = { hashedPassword: '0' };
    }

    const passwordsMatch = await bcrypt.compareSync(password, attemptedUser.hashedPassword);

    if (!passwordsMatch) {
      throw 'invalid username/password combo';
    } else {
      return attemptedUser;
    }
  },
};
