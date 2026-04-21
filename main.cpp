#include <iostream>
#include <string>
#include <vector>

using namespace std;
class Vehicle {
public:
  string licensePlate;
  string type;

  Vehicle(string plate, string vehicleType) {
    licensePlate = plate;
    type = vehicleType;
  }

  void showInfo() {
    cout << "  Type: " << type << " | Plate: " << licensePlate << endl;
  }
};
class Car : public Vehicle {
public:
  Car(string plate) : Vehicle(plate, "Car") {
    // nothing extra needed
  }
};
class Bike : public Vehicle {
public:
  Bike(string plate) : Vehicle(plate, "Bike") {
    // nothing extra needed
  }
};

class ParkingSpot {
public:
  int spotNumber;      // the spot ID (1, 2, 3, ...)
  bool isEmpty;        // true = spot is free, false = spot is taken
  string vehiclePlate; // which vehicle is parked here (if any)

  // Constructor - creates an empty parking spot
  ParkingSpot(int number) {
    spotNumber = number; // assign the spot number
    isEmpty = true;      // spot starts empty
    vehiclePlate = "";   // no vehicle parked yet
  }

  // Park a vehicle in this spot
  void parkVehicle(string plate) {
    isEmpty = false;      // spot is now occupied
    vehiclePlate = plate; // remember which vehicle is here
  }

  // Remove the vehicle from this spot
  void removeVehicle() {
    isEmpty = true;    // spot is free again
    vehiclePlate = ""; // clear the vehicle plate
  }

  // Show the status of this spot
  void showStatus() {
    if (isEmpty) {
      cout << "  Spot " << spotNumber << ": [EMPTY]" << endl;
    } else {
      cout << "  Spot " << spotNumber << ": [OCCUPIED] by " << vehiclePlate
           << endl;
    }
  }
};
class ParkingLot {
public:
  vector<ParkingSpot> spots; // list of all parking spots
  int totalSpots;            // total number of spots in the lot

  // Constructor - creates the parking lot with a given number of spots
  ParkingLot(int numSpots) {
    totalSpots = numSpots; // save total spots

    // Create each parking spot and add to our list
    for (int i = 1; i <= numSpots; i++) {
      spots.push_back(ParkingSpot(i)); // spots numbered 1, 2, 3...
    }

    cout << "Parking lot created with " << numSpots << " spots." << endl;
  }

  // Park a vehicle in the first available spot
  void parkVehicle(Vehicle &v) {
    // Go through each spot to find an empty one
    for (int i = 0; i < spots.size(); i++) {
      if (spots[i].isEmpty) {                 // if this spot is free
        spots[i].parkVehicle(v.licensePlate); // park the vehicle here
        cout << "  " << v.type << " [" << v.licensePlate << "] parked at Spot "
             << spots[i].spotNumber << "." << endl;
        return; // stop looking, we found a spot
      }
    }
    cout << "  Parking Full! Cannot park " << v.licensePlate << "." << endl;
  }
  void removeVehicle(string plate) {
    for (int i = 0; i < spots.size(); i++) {
      if (spots[i].vehiclePlate == plate) { // found the vehicle
        spots[i].removeVehicle();           // free the spot
        cout << "  Vehicle [" << plate << "] removed from Spot "
             << spots[i].spotNumber << "." << endl;
        return; // done
      }
    }
    cout << "  Vehicle [" << plate << "] not found in the parking lot." << endl;
  }

  void showAllSpots() {
    cout << "  --- Parking Lot Status ---" << endl;
    for (int i = 0; i < spots.size(); i++) {
      spots[i].showStatus(); // show each spot's status
    }
    cout << "  --------------------------" << endl;
  }

  // Show only the free/available spots
  void showFreeSpots() {
    cout << "  --- Available (Free) Spots ---" << endl;
    int freeCount = 0; // count how many are free

    for (int i = 0; i < spots.size(); i++) {
      if (spots[i].isEmpty) { // if spot is empty
        cout << "  Spot " << spots[i].spotNumber << " is FREE" << endl;
        freeCount++; // increase count
      }
    }

    if (freeCount == 0) {
      cout << "  No free spots available!" << endl; // all spots taken
    }

    cout << "  Total free spots: " << freeCount << endl;
    cout << "  ------------------------------" << endl;
  }
};
int main() {
  cout << "========================================" << endl;
  cout << "   Parking Lot Management System" << endl;
  cout << "========================================" << endl;
  cout << endl;

  // Ask the user how many spots the parking lot should have
  int totalSpots;
  cout << "Enter number of parking spots: ";
  cin >> totalSpots;
  cout << endl;

  // Create the parking lot with the number of spots user entered
  ParkingLot lot(totalSpots);
  cout << endl;

  int choice; // stores the user's menu choice

  // Keep showing the menu until the user chooses to exit (choice 5)
  do {
    // --- Show the menu ---
    cout << "========================================" << endl;
    cout << "              MAIN MENU" << endl;
    cout << "========================================" << endl;
    cout << "  1. Park a Vehicle" << endl;
    cout << "  2. Remove a Vehicle" << endl;
    cout << "  3. Show Parking Lot Status" << endl;
    cout << "  4. Show Free Spots" << endl;
    cout << "  5. Exit" << endl;
    cout << "========================================" << endl;
    cout << "Enter your choice (1-5): ";
    cin >> choice; // read user's choice
    cout << endl;

    // --- Option 1: Park a vehicle ---
    if (choice == 1) {
      string vehicleType; // will store "Car" or "Bike"
      string plate;       // will store the license plate

      // Ask user what type of vehicle they want to park
      cout << "Enter vehicle type (Car / Bike): ";
      cin >> vehicleType;

      // Ask user for the license plate number
      cout << "Enter vehicle number (license plate): ";
      cin >> plate;
      cout << endl;

      // Check what type was entered and create the right object
      if (vehicleType == "Car" || vehicleType == "car") {
        Car c(plate);       // create a Car object
        lot.parkVehicle(c); // park it using existing function
      } else if (vehicleType == "Bike" || vehicleType == "bike") {
        Bike b(plate);      // create a Bike object
        lot.parkVehicle(b); // park it using existing function
      } else {
        // If user typed something other than Car or Bike
        cout << "  Invalid vehicle type! Please enter Car or Bike." << endl;
      }
      cout << endl;
    }

    // --- Option 2: Remove a vehicle ---
    else if (choice == 2) {
      string plate; // plate of the vehicle to remove

      // Ask for the plate number of the vehicle to be removed
      cout << "Enter vehicle number (license plate) to remove: ";
      cin >> plate;
      cout << endl;

      // Call the existing remove function
      lot.removeVehicle(plate);
      cout << endl;
    }

    // --- Option 3: Show full parking lot status ---
    else if (choice == 3) {
      cout << "Parking Lot Status:" << endl;
      lot.showAllSpots(); // call existing function
      cout << endl;
    }

    // --- Option 4: Show only free/available spots ---
    else if (choice == 4) {
      cout << "Available Spots:" << endl;
      lot.showFreeSpots(); // call existing function
      cout << endl;
    }

    // --- Option 5: Exit ---
    else if (choice == 5) {
      cout << "========================================" << endl;
      cout << "   Thank you! Exiting the system." << endl;
      cout << "========================================" << endl;
    }

    // --- Invalid choice ---
    else {
      cout << "  Invalid choice! Please enter a number between 1 and 5."
           << endl;
      cout << endl;
    }

  } while (choice != 5); // keep looping until user picks 5 (Exit)

  return 0; // program finished successfully
}
