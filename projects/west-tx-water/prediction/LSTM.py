#-------------------------------------------------------------------
# By Nicholas Alvarez
# Not written to be the most modular thing in the world. Apologies for that.
# I had a lot of other work to do for classes so couldn't spend time cleaning up.
#
# The program assumes that all the data provided is mostly evenly spaced.
# If it is not, the prediction may be a little off.
#-------------------------------------------------------------------
#Remove this seeding when actually using it. I have it on for testing.
from numpy.random import seed
seed(1)
from tensorflow import set_random_seed
set_random_seed(2)

import csv
from datetime import datetime
from datetime import timedelta
import argparse

global inputReversed
inputReversed = False

#This will retrieve the data. Skips the
#   header and assumes its in chronological order (New to old)
#Returns list of vals in chronological order (old to New)
#Expects daily readings...
def ReadData(path):
    dates = []
    data = []
    with open(path, 'rt', ) as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            try:
                #We know its in order, so just need actual num...
                data.append(float(row[1]))
                dates.append(datetime.strptime(row[0], '%Y-%m-%d'))
            except ValueError:
                continue
    #Again, data assumed to be in order from newest to oldest.
    #data.reverse()
    #dates.reverse()
    if(dates[0] > dates[1]):
        print("Reversing input data order for processing...")
        data.reverse()
        dates.reverse()
        global inputReversed
        inputReversed = True
    return data, dates

#Handle Command Line Stuff...
parser = argparse.ArgumentParser(description='Run a LSTM Neural Network to predict the future of a sequence.')
parser.add_argument('path', type=str, help='Path to the input file. Expecting two columns, right being the data.')
parser.add_argument('timeCount', type=int, metavar='t', help='Number of time units to look ahead to. Use same units as input file.')
parser.add_argument('-g', '--graph', action='store_true', help='Toggle display of graph, default off.')
parser.add_argument('-s', '--save', action='store_true', help='Toggle saving an output file with predicted values.')
parser.add_argument('-o', '--output', type=str, default=None, help='Saves output file with name provided. Make sure to also use -s!')
parser.add_argument('-e', '--epochs', '--epoch', type=int, default=1000, help='Number of training passes. Default 1000.')
parser.add_argument('-v', '--verbose', type=int, default=0, help='Referse to verbose on the NN. 0(default) is silent, 1 is large progress bars, 2 is small notes each epoch.')
parser.add_argument('-b', '--batch_size', type=int, default=64, help='Sets the number of elements of the dataset to process at one time in the NN.')
args = parser.parse_args()
timeCount = args.timeCount


#-------------------------------------------------------------------
#Time to work on data formatting...
import numpy as np
#For setting up input format.
from sklearn.preprocessing import MinMaxScaler


#Read the water levels provided....
waterLevels, dates = ReadData(args.path)

#Scale between 0 and 1. LSTM sensitive to large data differences.
dataScaler = MinMaxScaler(feature_range=(0,1))
waterLevels = np.array(waterLevels)
waterLevels = np.reshape(waterLevels, (-1, 1))
waterLevels = dataScaler.fit_transform(waterLevels)

#Get the times array...
times = np.array([x * 1.0 for x in range(0,len(waterLevels)+timeCount)])

#Convert to LSTM happy format...
timeScaler = MinMaxScaler(feature_range=(0,1))
times = timeScaler.fit_transform(times.reshape(-1, 1))

#Split into known and unknown times...
trainTimes = times[:len(waterLevels)]
predictTimes = times[len(waterLevels):]

#Format into appropriate LSTM arrays
trainTimes = np.reshape(trainTimes, (trainTimes.shape[0], 1, trainTimes.shape[1]))
predictTimes = np.reshape(predictTimes, (predictTimes.shape[0], 1, predictTimes.shape[1]))

#Get the samples array...
trainSamples = np.array(waterLevels)



#-------------------------------------------------------------------
#Keras Modules and Requirement
from keras.models import Sequential
from keras.layers.core import Dense, Activation
from keras.layers.recurrent import LSTM
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import math

#Time to start building the NN
model = Sequential()

#Dimensions...
inOutNeurons = 1
hiddenNeurons = 3

#Main Layer
model.add(LSTM(hiddenNeurons, input_shape=(inOutNeurons, 1), return_sequences=False, activation='tanh', recurrent_activation='sigmoid'))
model.add(Activation('hard_sigmoid'))

#Output Layer
model.add(Dense(inOutNeurons))

#Ran through a lot of options here. This one seems to perform the best.
model.compile(loss="mean_squared_error", optimizer="nadam") #Previously Adam Optimizer

print("\nBeginning matrix magic...\n")

#Train the NN, batch_size previously 30, default 32
model.fit(trainTimes, trainSamples, epochs=args.epochs, batch_size=args.batch_size, verbose=args.verbose)

#Some predictions
trainPredict = model.predict(trainTimes, batch_size=args.batch_size)
testPredict = model.predict(predictTimes, batch_size=args.batch_size)

#Get the error and print it.
trainPredictActual = dataScaler.inverse_transform(trainPredict)
waterLevelsActual = dataScaler.inverse_transform(waterLevels)

error = mean_squared_error(waterLevelsActual, trainPredictActual)
print("\nMean Squared Error: " + str(error))

print("Root Mean Squared Error: " + str(math.sqrt(error)))

error = r2_score(waterLevelsActual, trainPredictActual)
print("R Squared Error: " + str(error))

error = mean_absolute_error(waterLevelsActual, trainPredictActual)
print("Mean Absolute Error: " + str(error))


#-------------------------------------------------------------------
#Optional File Saving Component
if(args.save):
    #Get the name for the output file
    outName = ""
    if(args.output == None):
        pathParts = args.path.split('\\')
        inName = pathParts[len(pathParts)-1]
        outName = inName.split('.')[0]
        outName = outName + '_LSTMpreditions.csv'
    else:
        outName = args.output

    #Prepare the data to be written
    outDates = dates
    outData = dataScaler.inverse_transform(np.concatenate((waterLevels, testPredict)))
    dateIncrement = dates[1]-dates[0]
    for i in range(len(dates), len(times)):
        #outDates.append(dates[-1] + dateIncrement*(i))
        outDates.append(outDates[-1] + dateIncrement)
    #Flip data to comply with original format.
    if(inputReversed):
        print('Flipping output data back to original order of file...')
        outData = np.flip(outData, 0)
        outDates = np.flip(outDates, 0)

    #Write the data.
    with open(outName, 'w', newline='') as CSV:
        writer = csv.writer(CSV, delimiter=',')
        writer.writerow(['datetime', 'water_level(ft below land surface)'])
        for i in range(0, len(outDates)):
            writer.writerow([outDates[i].strftime('%Y-%m-%d'), "{0:.2f}".format(outData[i][0])])



#-------------------------------------------------------------------
#Optional Graphing Component
if(args.graph):
    import matplotlib.pyplot as plt
    #Plotting


    #Invert Transforms
    trainPredict = dataScaler.inverse_transform(trainPredict)
    trainSamples = dataScaler.inverse_transform(trainSamples)
    testPredict = dataScaler.inverse_transform(testPredict)

    #Training Prediction Plot...
    trainPredictPlot = np.empty_like(trainPredict)
    trainPredictPlot[:, :] = np.nan
    trainPredictPlot[:len(trainPredict)+1, :] = trainPredict

    #Result Prediction Plot
    testPredictPlot = np.empty_like(times)
    testPredictPlot[:, :] = np.nan
    testPredictPlot[len(trainPredict)-1:len(trainPredict) + timeCount - 1, :] = testPredict

    plt.plot(dataScaler.inverse_transform(waterLevels))
    plt.plot(trainPredictPlot)
    plt.plot(testPredictPlot)
    plt.title("LSTM Result")
    plt.show()
