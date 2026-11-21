// Shared narrative steps for the room and the Robin app.
window.companionFlows = {
  keys: [
    { title:'Ready to leave', text:'You are getting ready to leave, but cannot find your keys.', room:{actor:{x:9.34,y:2.22,pose:'standing'}} },
    { title:'Ask Robin', text:'You ask Robin to help find your keys.', user:'{name}, where are my keys?' },
    { title:'Recall the last location', text:'Robin checks the last saved observation.', assistant:'I last saw them on the entryway tray at 8:10 am.', effect:'key-memory' },
    { title:'Move closer', text:'Robin moves towards the entryway to check.', room:{target:'entry',inspect:'entry',actor:{x:9.34,y:2.22,pose:'standing'}} },
    { title:'Point with light', text:'Robin confirms the keys and points a spotlight at the tray.', assistant:'There they are, on the left side of the entryway tray.', room:{target:'entry',spotlight:true} },
    { title:'Pick up the keys', text:'You pick up your keys. Robin switches off the spotlight.', user:'Found them, thanks.', assistant:'You’re welcome. Have a good day!', room:{target:'entry',spotlight:false,keysCollected:true,actor:{x:8.2,y:4.2,pose:'collected'}} }
  ],
  cooking: [
    {title:'Hands are busy',text:'You are preparing food at the kitchen counter, with your hands full.'},
    {title:'Call Robin',text:'You ask for help without touching your phone.',user:'{name}, come to the kitchen. Help me cook.'},
    {title:'Come to the kitchen',text:'Robin travels along the ceiling rail towards the worktop.',room:{target:'kitchen',inspect:'kitchen'}},
    {title:'Look at the ingredients',text:'Robin looks at the ingredients on the counter.',assistant:'I can see tomatoes. What are you making?',requiresCamera:true},
    {title:'Prepare the salad',text:'Robin gives one short instruction at a time.',user:'A tomato salad.',assistant:'Rinse the tomatoes and place them on the chopping board.'},
    {title:'Next recipe step',text:'You continue cooking and ask for the next step.',user:'What comes next?',assistant:'Slice the tomatoes and put them in the bowl.'},
    {title:'Hand over a napkin',text:'Robin picks up a napkin from the counter and carries it to you.',user:'{name}, bring me a napkin.',effect:'serve-napkin',requiresCamera:true}
  ],
  bedtime: [
    {title:'Time to wind down',text:'It is 10:25 pm. Your bedtime reminder is already in Memory.',effect:'bedtime-memory'},
    {title:'A gentle reminder',text:'At 10:30 pm, Robin gently reminds you to rest.',assistant:'It’s 10:30. Ready to wind down?'},
    {title:'Ten more minutes',text:'You ask for a short snooze. Memory updates to 10:40 pm.',user:'Remind me again in ten minutes.',assistant:'Okay. I’ll remind you at 10:40.',effect:'snooze'},
    {title:'Remind again',text:'Ten simulated minutes pass, and Robin reminds you again.',assistant:'It’s 10:40 now, the time you asked me to remind you.'},
    {title:'Press the wall switch',text:'Robin moves to the wall and presses the light switch with its gripper.',user:'{name}, turn off the lights.',effect:'press-light-switch'},
    {title:'Close the smart curtains',text:'Robin sends a close command to the demo smart-home service. The curtains slide shut.',user:'{name}, close the curtains.',effect:'close-curtains'},
    {title:'Close the lens cover',text:'You ask for privacy. Robin lowers the cover and turns the camera off.',user:'{name}, close your camera.',assistant:'Camera off. The lens cover is closed. Good night.',effect:'camera-off'},
    {title:'Open the cover by hand',text:'The next morning, you lift the lens cover by hand.',assistant:'Good morning. The lens cover is open again.',effect:'camera-on',room:{night:false,lightsOn:true,curtainsClosed:false,actor:{x:5.6,y:4.4,pose:'standing'}}}
  ],
  exam: [
    {title:'Read the exam email',text:'You open an exam notice in Campus Mail, a separate email app. The exam is tomorrow at 9:00 am.',view:'mail'},
    {title:'Take a screenshot',text:'You capture a screenshot of the email. This is an image, rather than a manually created reminder.',view:'screenshot'},
    {title:'Share the screenshot',text:'The system share sheet opens. You choose AI Assistant to share the screenshot with Robin.',view:'share'},
    {title:'Return to your conversation',text:'The existing Robin conversation opens with the screenshot attached to the composer.',view:'attachment'},
    {title:'Ask to wake up early',text:'You send the screenshot and ask Robin to wake you up early.',user:'Tomorrow’s exam starts at 9 am. Wake me up early.',effect:'send-screenshot'},
    {title:'Recognize and remember',text:'Robin reads the screenshot and saves the exam and wake-up reminder in Memory.',assistant:'Your Computer Science exam is tomorrow at 9:00 am. I’ll wake you at 7:00 so you have time to get ready. Both are in Memory.',effect:'exam-memory'},
    {title:'Review Memory',text:'You open Memory and see the exam and the scheduled 7:00 am wake-up reminder.',effect:'show-memory'},
    {title:'Reference in chat',text:'You reference the wake-up reminder. Its context appears in the existing conversation without sending a message.',effect:'reference-exam'},
    {title:'The next morning',text:'It is 6:42 am. Robin detects that you are already awake before the scheduled reminder.',assistant:'Good morning. I noticed you’re already awake, so I won’t wake you again. Your exam is at 9:00 — plenty of time.',effect:'awake'},
    {title:'Review the result',text:'Memory shows the wake-up reminder as skipped for today. The 9:00 am exam stays scheduled.',effect:'show-memory'}
  ]
};
