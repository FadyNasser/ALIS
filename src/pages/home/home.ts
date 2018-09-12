import { FCM } from '@ionic-native/fcm';
import { Calendar } from '@ionic-native/calendar';
import { Network } from '@ionic-native/network';
import { SharingService } from './../../services/Sharing-Service/SharingService.service';
import { Component, NgZone, ViewChild } from '@angular/core';
import { NavController, Platform, Content, AlertController, Alert } from 'ionic-angular';
import { AngularFireDatabase } from '../../../node_modules/angularfire2/database';
import { Contacts } from '@ionic-native/contacts';
import * as APIModule from 'apiai';
import { Subscription } from 'rxjs';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  @ViewChild(Content) content: Content;
  chat; //User Message
  answer; //ALIS Reply
  CurrentTime; //Message's Sent Time
  showImage = []; //array indicating there is a message or no
  DisplayImage = []; //array containing the images
  Tutors = [];
  items = [];
  need_tutor = 0;
  Token = '';
  question: string;
  SU_name: string;
  SU_ques = [];
  applicant_id: string;
  filling_form = false;
  q_num = 1;
  end_of_form = false;
  rated;
  API_Agent: APIModule.Application;
  connected: Subscription;
  disconnected: Subscription;
  offline_alert: Alert;

  Friends = []
  Show_Friends = false
  Current_Tutor;
  Intent_type = 'Welcome'
  Intent_data;
  tutor_Feedback = false;
  Alis_first = false
  SignedIn = false
  constructor(public navCtrl: NavController, public platform: Platform, public ngZone: NgZone, private afDatabase: AngularFireDatabase, private Share: SharingService, private contacts: Contacts, private network: Network, private calendar: Calendar, private alertCtrl: AlertController, private fcm: FCM) {
    // console.log(this.GetDate_and_Time());
    if (!navigator.onLine) {
      this.offline_alert = this.alertCtrl.create({
        title: "You're offline",
        subTitle: "Alis can't reach you without internet connection",
        enableBackdropDismiss: false
      });
      this.offline_alert.present();
    }

    fcm.onNotification().subscribe(notification => {
      this.SignedIn = true;
      if (notification.wasTapped) {
        console.log("Received in background");
        this.Intent_type = notification.type
        this.Intent_data = JSON.parse(notification.data)
        console.log(this.Intent_data);
      } else {
        console.log("Received in foreground");
      };
    })

    platform.ready().then(() => {
      this.API_Agent = APIModule("7327b7cfa4a144a0b3924da4f9b375b9");
      this.Token = this.Share.getToken();
      console.log("Initializing...");
      //sign in by token
      this.Update_Time()
      this.Alis_first = true
      if (this.Intent_type == "rating") {
        this.API_Agent.eventRequest({ name: "getFeedback" }, { sessionId: '0123456789' })
          .once('response', ({ result: { fulfillment: { speech } } }) => {
            this.answer = speech;
          }).once('error', (error) => {
            console.log(error);
          }).end();
      }
      else if (this.Intent_type == "Welcome") {
        this.afDatabase.database.ref('/users').once('value').then((snapshot1) => {
          if (snapshot1.child(this.Token).exists()) {
            this.API_Agent.eventRequest({ name: "Welcome", data: { 'Name': snapshot1.child(this.Token).child('First_name').val() } }, { sessionId: '0123456789' })
              .once('response', ({ result: { fulfillment: { speech } } }) => {
                speech = speech + "😊";
                this.answer = speech;
                this.SignedIn = true;
              }).once('error', (error) => {
                console.log(error);
              }).end();
          } else {
            this.API_Agent.eventRequest({ name: "Welcome" }, { sessionId: '0123456789' })
              .once('response', ({ result: { fulfillment: { speech } } }) => {
                speech = speech + "😊";
                this.answer = speech;
              }).once('error', (error) => {
                console.log(error);
              }).end();
          }
        });
      }
    })
  }

  ionViewDidEnter() {

    this.connected = this.network.onConnect().subscribe(data => {
      console.log(`You are now ${data.type} via ${this.network.type}`)
      this.offline_alert.dismiss();
      this.offline_alert = this.alertCtrl.create({
        title: "You're offline",
        subTitle: "Alis can't reach you without internet connection",
        enableBackdropDismiss: false
      });
    }, error => console.error(error));

    this.disconnected = this.network.onDisconnect().subscribe(data => {
      console.log(`You are now ${data.type} via ${this.network.type}`)
      this.offline_alert.present();
    }, error => console.error(error));
  }

  ionViewWillLeave() {
    this.connected.unsubscribe();
    this.disconnected.unsubscribe();
  }

  GetDate_and_Time() {
    var d = new Date(),
      date = [(d.getMonth() + 1), d.getDate(), d.getFullYear()].join("/"),
      time = [(d.getHours() > 12) ? d.getHours() - 12 : (d.getHours() == 0) ? "12" : d.getHours(), d.getMinutes()].join(":"),
      ampm = (d.getHours() < 12) ? "AM" : "PM"
    return { 'Date': date, 'Time': time, 'AMPM': ampm };
  }

  Update_Time() {
    var d = new Date(),
      time = [(d.getHours() > 12) ? d.getHours() - 12 : (d.getHours() == 0) ? "12" : d.getHours(), d.getMinutes()].join(":"),
      ampm = (d.getHours() < 12) ? "AM" : "PM"
    this.CurrentTime = time + ' ' + ampm;
  }

  SyncFriends() {
    this.contacts.find(['*'])
      .then(contactslist => {
        var numbers = []
        contactslist.forEach(data => {
          if (data.name) {
            if (data.name.formatted == undefined) {
              return
            }
          }
          else {
            return
          }

          if (data.phoneNumbers) {
            let phones = new Set<string>()
            var phone_as_name = false;
            data.phoneNumbers.some(phonenumber => {
              phonenumber.value = phonenumber.value.replace(/ +/g, "");
              if (data.name.formatted.trim() != phonenumber.value) {
                phones.add(phonenumber.value)
              }
              else {
                phone_as_name = true
                return true
              }
            })
            if (phone_as_name) {
              return
            }
            phones.forEach(phone => { numbers.push({ Phone: phone, Found: false }) })
          }
        })
        var friends = []
        this.afDatabase.database.ref('/users').once('value').then((snapshot1) => {
          if (snapshot1.exists()) {
            snapshot1.forEach((snapshot2) => {
              for (let index = 0; index < numbers.length; index++) {
                if (snapshot2.child('Phone').val() == numbers[index].Phone && numbers[index].Found == false) {
                  numbers[index].Found = true
                  friends.push(numbers[index].Phone)
                  let data = { Friends: friends };
                  this.addData('/users', this.Token, null, data).then().catch();
                  break
                }
              }
            })
          }
        });
      });
  }

  ask() {
    if (this.question == null) { return; }
    this.items = ["hi", " hello", "try again", "exit", "close"];
    this.Alis_first = false
    this.need_tutor = 0;
    this.tutor_Feedback = false
    this.rated = null
    this.Friends = []
    this.Show_Friends = false
    this.content.scrollToBottom();
    this.chat = this.question;
    this.Update_Time()
    this.content.scrollToBottom();

    if (this.filling_form) {
      if (this.end_of_form) {
        console.log("ay hary");
        this.filling_form = false;
        this.q_num = 1;
        this.answer = "okay now you're done";
      }
      else {
        this.add_form_answers('' + this.q_num, this.question);
        this.q_num++;
        this.get_application_questions("" + this.q_num);
      }
    }
    else {
      this.API_Agent.textRequest(this.question, { sessionId: '0123456789' })
        .once('response', ({ result }) => {
          if (result.action == "SignIn.SignIn-phone") {
            this.afDatabase.database.ref('/users').once('value').then((snapshot1) => {
              if (snapshot1.exists()) {
                let phonefound = false
                snapshot1.forEach((snapshot2) => {
                  if (snapshot2.child('Phone').val() == result.parameters['phone-number']) {
                    phonefound = true
                    if (snapshot2.child('Phone').ref.parent.key != this.Token) {
                      var child = snapshot2.child('Phone').ref.parent;
                      child.once('value').then((replace) => {
                        child.parent.child(this.Token).set(replace.val());
                        child.remove();
                      });
                    }
                    this.API_Agent.eventRequest({ name: "Welcome", data: { 'Name': snapshot2.child('First_name').val() } }, { sessionId: '0123456789' })
                      .once('response', ({ result: { fulfillment: { speech } } }) => {
                        speech = speech + "😊";
                        this.answer = speech;
                        this.SignedIn = true;
                      }).once('error', (error) => {
                        console.log(error);
                      }).end();
                  }
                })
                if (!phonefound) {
                  this.answer = "Sorry, I can't find your number. You can sign up again!😊";
                }
              } else {
                this.answer = "I think you should sign up!😊";
              }
            })
          }
          else if (result.action == "SignUp-Credentials" && result.actionIncomplete == false) {
            this.afDatabase.database.ref('/users').once('value').then((snapshot1) => {
              if (snapshot1.exists()) {
                let phonefound = false
                snapshot1.forEach((snapshot2) => {
                  if (snapshot2.child('Phone').val() == result.parameters['phone-number']) {
                    phonefound = true
                    return
                  }
                })
                if (phonefound) {
                  this.answer = "This number is already used"
                }
                else {
                  let data = { First_name: result.parameters["First-name"], Last_name: result.parameters["Last-name"], Phone: result.parameters["phone-number"] };
                  this.addData('/users', this.Token, null, data).then().catch();
                  this.answer = result.fulfillment.speech;
                  this.SignedIn = true;
                }
              }
            })
          }
          else if (result.action == "Synchronize_Friends" && this.SignedIn == true) {
            this.SyncFriends();
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == "Show_Friends" && this.SignedIn == true) {
            this.answer = result.fulfillment.speech;
            this.afDatabase.database.ref(`users/${this.Token}/Friends`).once('value').then(snapshot1 => {
              if (snapshot1.exists()) {
                snapshot1.forEach(snapshot2 => {
                  this.afDatabase.database.ref('users').once('value').then(snapshot2_1 => {
                    snapshot2_1.forEach(snapshot2_2 => {
                      if (snapshot2_2.child('Phone').val() == snapshot2.val()) {
                        let Friend = {
                          Name: snapshot2_2.child('First_name').val() + " " + snapshot2_2.child('Last_name').val(),
                          Phone: snapshot2.val(),
                          checked: false
                        }
                        this.Friends.push(Friend)
                      }
                    })
                  })
                })
              }
            })
            this.Show_Friends = true
          }
          else if (result.action == "needTutor" && this.SignedIn == true) {
            this.afDatabase.database.ref('/teachers').child(result.parameters.tutorSubject)
              .once('value').then(snapshot1 => {
                snapshot1.forEach(snapshot2 => {
                  let tutor = {
                    subject: result.parameters.tutorSubject,
                    name: snapshot2.child('name').val(),
                    phone: snapshot2.child('phone').val(),
                    cost: snapshot2.child('cost').val(),
                    image: snapshot2.child('image').val(),
                    lessons: snapshot2.child('lessons').val()
                  }
                  this.Tutors.push(tutor);
                })
                this.need_tutor = 1;
              })
          }
          else if (result.action == "study_level" && this.SignedIn == true) {

            if (result.parameters.study_level !== '') {
              let data = { studyLevel: result.parameters.study_level };
              this.addData('/users', this.Token, null, data).then().catch();
            }
            console.log(result);
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'get_hobbies' && this.SignedIn == true) {
            if (result.parameters.hobbies.length > 0) {
              let data = { hobbies: result.parameters.hobbies };
              this.addData('/users', this.Token, null, data).then().catch();
            }

            this.answer = result.fulfillment.speech;

            console.log(result);
          }
          else if (result.action == 'father_job' && this.SignedIn == true) {
            if (result.parameters.father_job !== '') {
              let data = { fatherJob: result.parameters.fatherJob };
              this.addData('/users', this.Token, null, data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'mother_job' && this.SignedIn == true) {
            if (result.parameters.mother_job !== '') {
              let data = { motherJob: result.parameters.motherJob };
              this.addData('/users', this.Token, null, data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'school_name' && this.SignedIn == true) {
            if (result.parameters.school_name !== '') {
              let data = { schoolName: result.parameters.school_name };
              this.addData('/users', this.Token, null, data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getNational' && this.SignedIn == true) {
            if (result.parameters.highSchoolDegree !== '') {
              let data = { highSchoolDegree: result.parameters.highSchoolDegree };
              this.addData('/users', this.Token, null, data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getSat' && this.SignedIn == true) {
            if (result.parameters.highSchoolDegree !== '') {
              let data = { highSchoolDegree: result.parameters.highSchoolDegree };
              this.addData('/users', this.Token, null, data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getIG' && this.SignedIn == true) {
            if (result.parameters.highSchoolDegree !== '') {
              let data = { highSchoolDegree: result.parameters.highSchoolDegree };
              this.addData('/users', this.Token, null, data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getTanyaThanawyGrade' && this.SignedIn == true) {
            let gradeNum;
            if (result.parameters.tanyaPercentage !== '') {
              let gradePercentage = result.parameters.tanyaPercentage;
              gradeNum = gradePercentage.slice(0, -1);
            } else if (result.parameters.tanyaNum !== '') {
              gradeNum = result.parameters.tanyaNum;
            }
            let data = { tanyaThanwyGrade: gradeNum };
            this.addData('/users', this.Token, 'thanawyGrades', data).then().catch();


            this.answer = result.fulfillment.speech;
          } else if (result.action == 'getTaltaThanawyGrade' && this.SignedIn == true) {
            let gradeNum;
            if (result.parameters.taltaPercentage !== '') {
              let gradePercentage = result.parameters.taltaPercentage;
              gradeNum = gradePercentage.slice(0, -1);
            } else if (result.parameters.taltaNum !== '') {
              gradeNum = result.parameters.taltaNum;
            }
            let data = { taltaThanwyGrade: gradeNum };
            this.addData('/users', this.Token, 'thanawyGrades', data).then().catch();

            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getSat1' && this.SignedIn == true) {
            let gradeNum;
            if (result.parameters.sat1Percentage !== '') {
              let gradePercentage = result.parameters.sat1Percentage;
              gradeNum = gradePercentage.slice(0, -1);
            }
            else if (result.parameters.sat1Num !== '') {
              gradeNum = result.parameters.sat1Num;
            }
            let data = { sat1Grade: gradeNum };
            this.addData('/users', this.Token, 'satGrades', data).then().catch();

            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getSat2' && this.SignedIn == true) {
            let gradeNum;
            if (result.parameters.sat2Percentage !== '') {
              let gradePercentage = result.parameters.sat2Percentage;
              gradeNum = gradePercentage.slice(0, -1);
            }
            else if (result.parameters.sat2Num !== '') {
              gradeNum = result.parameters.sat2Num;
            }
            let data = { sat2Grade: gradeNum };
            this.addData('/users', this.Token, 'satGrades', data).then().catch();

            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getIGArabicGrade' && this.SignedIn == true) {
            if (result.parameters.arabicIG_Grade !== '') {
              let data = { arabicGrade: result.parameters.arabicIG_Grade };

              this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getIGEnglishGrade' && this.SignedIn == true) {
            console.log(result);
            if (result.parameters.englishIG_Grade !== '') {
              let data = { englishGrade: result.parameters.englishIG_Grade };
              this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getIGMathGrade' && this.SignedIn == true) {
            if (result.parameters.mathIG_Grade !== '') {
              let data = { mathGrade: result.parameters.mathIG_Grade };
              this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getIGChemistryGrade' && this.SignedIn == true) {
            if (result.parameters.chemistryIG_Grade !== '') {
              let data = { chemistryGrade: result.parameters.chemistryIG_Grade };
              this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getIGPhysicsGrade' && this.SignedIn == true) {
            if (result.parameters.physicsIG_Grade !== '') {
              let data = { chemistryGrade: result.parameters.physicsIG_Grade };
              this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getIGBiologyGrade' && this.SignedIn == true) {
            if (result.parameters.biologyIG_Grade !== '') {
              let data = { chemistryGrade: result.parameters.biologyIG_Grade };
              this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
            }
            this.answer = result.fulfillment.speech;
          }
          else if (result.action == 'getFeedback-yes' && this.SignedIn == true) {
            this.API_Agent.eventRequest({ name: "getFeedback-yes", data: { 'tutorName': this.Intent_data.tutorName, 'subject': this.Intent_data.subject } }, { sessionId: '0123456789' })
              .once('response', ({ result: { fulfillment: { speech } } }) => {
                speech = speech + "😊";
                this.answer = speech;
                this.tutor_Feedback = true
              }).once('error', (error) => {
                console.log(error);
              }).end();
          }
          else if (result.action == "Student_activity_name" && this.SignedIn == true) {
            this.SU_name = result.parameters.Student_Activities;
            if (!this.SU_name) {
              this.answer = result.fulfillment.speech;
            }
            else {
              this.get_application_questions('1');
              this.applicant_id = this.afDatabase.database.ref('/' + this.SU_name + "_applicants").push({
                token: this.Token
              }).key;
              this.filling_form = true;
              this.end_of_form = false;
            }
          }
          else if (result.action !== "input.unknown" && result.action !== "input.welcome" && result.action !== "SignIn" && result.action !== "SignUp" && this.SignedIn == false) {
            this.answer = "I think you should sign in!😊"
          }
          else {
            console.log(result.fulfillment.speech);
            this.answer = result.fulfillment.speech;
          }
        }).once('error', (error) => {
          console.log(error);
        }).end();
    }

    this.question = null;
  }

  addData(collection, child, nextChild, data) {
    if (nextChild) {
      return this.afDatabase.database.ref(collection).child(child).child(nextChild).update(data);
    }
    return this.afDatabase.database.ref(collection).child(child).update(data);
  }

  get_application_questions(Q_num: string) {
    return this.afDatabase.database.ref('/forms').child(this.SU_name).child(Q_num).once('value').then(snapshot => {
      if (snapshot.exists()) {
        this.answer = snapshot.val();
      }
      else {
        console.log("ending");
        this.end_of_form = true;
      }
    });
  }

  add_form_answers(ques_num: string, answer: string) {
    return this.afDatabase.database.ref('/' + this.SU_name + "_applicants").child(this.applicant_id).child("" + this.q_num).update({
      answer
    });
  }

  rating(x) {
    this.rated = x;
    let data = {}
    data[this.Intent_data.phone] = this.rated
    this.addData('/users', this.Token, 'Ratings', data).then().catch();
    this.answer = "Thanks for your Feedback😊"
  }

  // Invite(){
  //   for (let index = 0; index < this.Friends.length; index++) {
  //     console.log(this.Friends[index]);
  //   }
  // }

  Tutor_Select(Tutor) {
    this.Current_Tutor = Tutor
    this.need_tutor = 2
  }

  Tutor_Reserve(i) {
    let data = { subject: this.Current_Tutor.subject, name: this.Current_Tutor.name, phone: this.Current_Tutor.phone, slot: this.Current_Tutor.lessons[i].slot, cost: this.Current_Tutor.lessons[i].cost };
    this.afDatabase.database.ref('users').child(this.Token).child('lessonsRequests').push(data);
    var dt = new Date(this.Current_Tutor.lessons[i].slot)
    this.calendar.createEventWithOptions(`${this.Current_Tutor.subject} class`, null, null, dt, dt, { 'firstReminderMinutes': 120 })
    this.need_tutor = 0;
    this.Current_Tutor = '';
    this.Tutors = [];
    this.answer = "I reserved your lesson! 😊";
  }
}
